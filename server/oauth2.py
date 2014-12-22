import requests, json, urllib, urlparse, string, random, base64, Crypto, jwt

google_discovery_url = 'https://accounts.google.com/.well-known/openid-configuration'

class Provider:
    def __init__(self):
        self._config = {}
        self.id_token = None
        self.keys = []

    def jwt_decode(self, token):
        token = token.encode('ascii')
        header, payload, sig = map(_b64dec, token.split('.', 3))
        header = json.loads(header)
        for k in self.keys:
            if k['kid'] == header['kid']:
                return jwt.decode(token, k['imported'])

    def config(self, **kw):
        self._config.update(kw)

    def google_discover(self):
        self.discover(google_discovery_url)

    def refresh_keys(self):
        del self.keys[:]
        self.load_keys()

    def load_keys(self, url=None):
        if url is None:
            if 'jwks_uri' not in self._config:
                return
            url = self._config['jwks_uri']

        r = requests.get(url)
        if r.status_code != 200:
            raise OAuthError('invalid response from the token_endpoint', r)
        if r.headers.get('content-type').split(';', 1)[0] != 'application/json':
            raise OAuthError('invalid response from the token_endpoint', r)
        for k in json.loads(r.content)['keys']:
            self.add_key(k)

    def add_key(self, key):
        if key['kty'] == 'RSA':
            t = key['n'], key['e']
            t = map(lambda s: s.encode('ascii'), t)
            t = map(base64.urlsafe_b64decode, t)
            t = map(Crypto.Util.number.bytes_to_long, t)
            key['imported'] = Crypto.PublicKey.RSA.construct(t)
        else:
            return

        self.keys.append(key)

    def discover(self, url, verify=True):
        self._config.update(
            _discover(url, verify=verify))

    def get_auth_code_url(self, scopes, state=None):
        if state is None:
            state = _randstr()
            self._state = state

        scheme, netloc, path, query, fragment = urlparse.urlsplit(
            self._config['authorization_endpoint'])
        if fragment:
            raise OAuthError('authorization_endpoint must not have a fragment part')

        q = urlparse.parse_qs(query)
        q.update({
            'client_id': self._config['client_id'],
            'response_type': 'code',
            'scope': ' '.join(scopes),
            'redirect_uri': self._config['redirect_uri'],
            'state': state,
            })

        return urlparse.urlunsplit((scheme, netloc, path, urllib.urlencode(q), ''))

    def process_auth_code_query(self, q):
        if isinstance(q, str):
            q = urlparse.parse_qs(q)
        if q['state'][0] != self._state:
            raise OAuthError('anti-forgery token does not match')
        return self.process_auth_code(q['code'])

    def process_auth_code(self, code):
        q = {
            'code': code,
            'client_id': self._config['client_id'],
            'client_secret': self._config['client_secret'],
            'redirect_uri': self._config['redirect_uri'],
            'grant_type': 'authorization_code',
            }
        r = requests.post(self._config['token_endpoint'], data=q)
        if r.status_code != 200:
            raise OAuthError('invalid response from the token_endpoint', r)
        if r.headers.get('content-type').split(';', 1)[0] != 'application/json':
            raise OAuthError('invalid response from the token_endpoint', r)

        j = json.loads(r.content)

        if 'id_token' in j:
            if not self.keys:
                self.load_keys()

            dec = self.jwt_decode(j['id_token'])
            if dec is not None:
                j['id_token_dec'] = dec

        return j

def _b64dec(s):
    rem = (4 - (len(s) % 4)) % 4
    return base64.urlsafe_b64decode(s + '='*rem)

def _discover(url, verify=True):
    r = requests.get(url, verify=verify)
    if r.status_code // 100 != 2:
        raise OAuthError('Failed to fetch the discovery document', r)
    if r.headers.get('content-type') != 'application/json':
        raise OAuthError('Expected the discovery document to be json-encoded', r)
    res = json.loads(r.content)
    return res

class OAuthError(Exception):
    def __init__(self, msg, resp=None):
        Exception.__init__(self, msg)
        self.resp = resp

def _randstr():
    return ''.join(random.choice(string.ascii_uppercase + string.digits)
                  for x in xrange(32))
