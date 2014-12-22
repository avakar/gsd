from flask import Flask, request, abort
import flask_cors, oauth2, jwt, psycopg2, json

jwt_secret = 'asdfavradfdasf'

class Conn:
    def __init__(self):
        self.conn = psycopg2.connect(database='gsd', user='avakar', password='wRu48NhM', host='ratatanek.cz')
        self.cur = self.conn.cursor()

    def __enter__(self):
        return self.cur

    def __exit__(self, type, value, tb):
        try:
            if not value:
                self.conn.commit()
        except:
            pass
        self.cur.close()
        self.conn.close()

google_openid = oauth2.Provider()
google_openid.google_discover()

app = Flask(__name__)
app.config['CORS_HEADERS'] = 'content-type'
flask_cors.CORS(app)

@app.route('/')
def index():
    return 'Hello world'

@app.route('/auth/google', methods=['POST'])
def google_auth():
    d = json.loads(request.get_data())
    id_token = d.get('id_token')
    if id_token is None:
        abort(400)

    google_openid.refresh_keys()
    tok = google_openid.jwt_decode(id_token)
    if tok is None or tok['iss'] != 'accounts.google.com':
        abort(400)

    with Conn() as cur:
        cur.execute('select id from users where iss = %s and sub = %s', (tok['iss'], tok['sub']))
        if cur.rowcount == 0:
            cur.execute('insert into users (iss, sub) values (%s, %s) returning id', (tok['iss'], tok['sub']))
        id = cur.fetchone()[0]

    return jwt.encode({'iss': 'gsd.ratatanek.cz', 'sub': str(id)}, jwt_secret)

if __name__ == '__main__':
    app.debug = True
    app.run()
