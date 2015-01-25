import sys, os.path
sys.path.insert(0, os.path.split(__file__)[0])

from flask import Flask, request, abort, make_response, send_from_directory
import flask_cors, oauth2, jwt, psycopg2, json, time

import yaml
with open(os.path.join(os.path.split(__file__)[0], 'settings.yaml'), 'rb') as fin:
    settings = yaml.load(fin)

print settings
dbconfig = settings['database']
jwt_secret = settings['jwt_secret']

class Conn:
    def __init__(self):
        self.conn = psycopg2.connect(
            database=dbconfig['database'],
            user=dbconfig['user'],
            password=dbconfig['password'],
            host=dbconfig.get('host'),
            port=dbconfig.get('port'))
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
application = app

app.config['CORS_HEADERS'] = ['content-type', 'authorization']
app.config['CORS_METHODS'] = ['GET', 'POST', 'PUT']
flask_cors.CORS(app)

def authorize():
    toks = request.headers.get('authorization', '').split(' ')
    if len(toks) != 2 or toks[0] != 'Bearer':
        abort(401)
    auth = jwt.decode(toks[1], jwt_secret)
    if auth['iss'] != 'gsd.ratatanek.cz':
        abort(401)
    return int(auth['sub'])

@app.route('/', methods=['GET'])
def ident():
    return 'gsd_server'

@app.route('/tasks', methods=['GET', 'PUT'])
def list_tasks():
    user_id = authorize()

    if request.method == 'GET':
        with Conn() as cur:
            cur.execute('select tasks, tasks_version from users where id = %s', (user_id,))
            tasks, version = cur.fetchone()
            if tasks is None:
                tasks = []
                version = 0
            else:
                tasks = json.loads(tasks)
                version = time.mktime(version.timetuple())
        resp = {
            'version': version,
            'tasks': tasks
            }
    elif request.method == 'PUT':
        data = json.loads(request.get_data())
        tasks = data['tasks']
        id_remap = []
        with Conn() as cur:
            cur.execute('select next_task_id from users where id=%s', (user_id,))
            next_task_id = cur.fetchone()[0]

            for task in tasks:
                if task['id'] < 0:
                    id_remap.append((task['id'], next_task_id))
                    task['id'] = next_task_id
                    next_task_id += 1

            cur.execute(
                'update users set tasks=%s, tasks_version=now(), next_task_id=%s where id=%s returning tasks_version',
                (json.dumps(tasks), next_task_id, user_id))
            version, = cur.fetchone()

        resp = {
            'version': time.mktime(version.timetuple()),
            'id_remap': id_remap,
            }
    else:
        resp = {}

    resp = make_response(json.dumps(resp))
    resp.headers['content-type'] = 'application/json'
    return resp

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

    resp = make_response(json.dumps({
        'token': jwt.encode({'iss': 'gsd.ratatanek.cz', 'sub': str(id)}, jwt_secret)
        }))
    resp.headers['content-type'] = 'application/json'
    return resp

app.debug = True

if __name__ == '__main__':
    #app.debug = True
    app.run(host='0.0.0.0', port=5000)
