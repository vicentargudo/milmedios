import os
import sqlite3
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'huerto.db')
STATIC_DIR = os.path.join(BASE_DIR, '..') # serves the frontend
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')

os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload


# ============================================================
# DATABASE
# ============================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS diary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'observacion',
            crops TEXT DEFAULT '[]',
            notes TEXT DEFAULT '',
            media TEXT DEFAULT '[]',
            author TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            priority TEXT DEFAULT 'media',
            category TEXT DEFAULT 'otro',
            notes TEXT DEFAULT '',
            done INTEGER DEFAULT 0,
            author TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS weather_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            temp REAL,
            temp_max REAL,
            temp_min REAL,
            humidity REAL,
            rain REAL,
            wind REAL,
            weather_code INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()

    # Seed default tasks if empty
    count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    if count == 0:
        seed_default_tasks(conn)

    # Seed initial diary entry if empty
    count = conn.execute("SELECT COUNT(*) FROM diary").fetchone()[0]
    if count == 0:
        seed_initial_diary(conn)

    conn.close()


def seed_default_tasks(conn):
    year = datetime.now().year
    defaults = [
        ('Labrar el huerto (30cm profundidad)', f'{year}-03-15', 'alta', 'labrar', 'Labrar toda la parcela, retirar piedras y malas hierbas.'),
        ('Añadir compost/estiércol', f'{year}-03-16', 'alta', 'abonado', 'Mezclar compost maduro o estiércol bien curado con la tierra.'),
        ('Preparar bancales', f'{year}-03-20', 'alta', 'otro', 'Marcar bancales de 1.2m ancho y pasillos de 0.5m.'),
        ('Semillero de pimientos', f'{year}-03-10', 'alta', 'semillero', 'En interior o invernadero, temperatura 20-25°C. Tardan 10-20 días en germinar.'),
        ('Semillero de calabacines', f'{year}-04-01', 'media', 'semillero', 'En macetas individuales, temperatura 20°C mínimo.'),
        ('Semillero de pepinos', f'{year}-04-01', 'media', 'semillero', 'Similar a calabacín. Ambiente cálido y húmedo.'),
        ('Instalar riego por goteo', f'{year}-04-15', 'alta', 'riego', 'Tender mangueras de goteo en ambos bancales. Programador con 2 riegos/día en verano.'),
        ('Trasplantar tomates al huerto', f'{year}-05-01', 'alta', 'trasplante', 'Cuando tengan 15-20cm y las noches >10°C. Enterrar hasta las primeras hojas.'),
        ('Trasplantar pimientos', f'{year}-05-01', 'alta', 'trasplante', 'Similar a tomates pero no enterrar el tallo.'),
        ('Trasplantar calabacines y pepinos', f'{year}-05-10', 'media', 'trasplante', 'Cuando hayan pasado las últimas heladas.'),
        ('Acolchado (mulch) en bancales', f'{year}-05-15', 'media', 'acolchado', 'Paja, cartón o corteza. Retiene humedad, evita malas hierbas.'),
        ('Colocar tutores para tomates', f'{year}-05-10', 'alta', 'otro', 'Cañas o estacas de 1.5m. Atar con hilo de rafia sin apretar.'),
        ('Instalar espalderas para pepinos', f'{year}-05-10', 'media', 'otro', 'Red o cañas para que trepen.'),
        ('Primera poda de tomates (chupones)', f'{year}-06-01', 'media', 'poda', 'Eliminar brotes axilares semanalmente. Dejar 1-2 tallos principales.'),
        ('Revisión de plagas y enfermedades', f'{year}-06-15', 'media', 'tratamiento', 'Buscar pulgón, mosca blanca, araña roja. Jabón potásico.'),
    ]
    for name, date, priority, category, notes in defaults:
        conn.execute(
            "INSERT INTO tasks (name, date, priority, category, notes) VALUES (?, ?, ?, ?, ?)",
            (name, date, priority, category, notes)
        )
    conn.commit()


def seed_initial_diary(conn):
    conn.execute(
        "INSERT INTO diary (date, type, crops, notes, author) VALUES (?, ?, ?, ?, ?)",
        ('2026-03-08', 'semillero', '["tomate"]',
         'Hoy hice el semillero de tomate. Primer paso de la temporada.', '')
    )
    conn.commit()


# ============================================================
# SERVE FRONTEND
# ============================================================
@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


# ============================================================
# DIARY API
# ============================================================
@app.route('/api/diary', methods=['GET'])
def get_diary():
    conn = get_db()
    entries = conn.execute("SELECT * FROM diary ORDER BY date DESC, id DESC").fetchall()
    conn.close()
    result = []
    for e in entries:
        result.append({
            'id': e['id'],
            'date': e['date'],
            'type': e['type'],
            'crops': json.loads(e['crops']),
            'notes': e['notes'],
            'media': json.loads(e['media']),
            'author': e['author'],
            'created_at': e['created_at'],
        })
    return jsonify(result)


@app.route('/api/diary', methods=['POST'])
def create_diary():
    data = request.json
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO diary (date, type, crops, notes, media, author) VALUES (?, ?, ?, ?, ?, ?)",
        (
            data.get('date', datetime.now().strftime('%Y-%m-%d')),
            data.get('type', 'observacion'),
            json.dumps(data.get('crops', [])),
            data.get('notes', ''),
            json.dumps(data.get('media', [])),
            data.get('author', ''),
        )
    )
    conn.commit()
    entry_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': entry_id, 'ok': True}), 201


@app.route('/api/diary/<int:entry_id>', methods=['DELETE'])
def delete_diary(entry_id):
    conn = get_db()
    conn.execute("DELETE FROM diary WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ============================================================
# MEDIA UPLOAD
# ============================================================
@app.route('/api/upload', methods=['POST'])
def upload_media():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400

    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'No filename'}), 400

    # Generate unique filename
    ext = os.path.splitext(f.filename)[1].lower()
    filename = f"{int(time.time() * 1000)}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    f.save(filepath)

    return jsonify({
        'ok': True,
        'url': f'/uploads/{filename}',
        'name': f.filename,
        'type': 'image' if ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic')
                else 'video' if ext in ('.mp4', '.mov', '.webm', '.avi')
                else 'audio' if ext in ('.mp3', '.wav', '.ogg', '.webm', '.m4a')
                else 'file',
    }), 201


# ============================================================
# TASKS API
# ============================================================
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    conn = get_db()
    tasks = conn.execute("SELECT * FROM tasks ORDER BY done ASC, date ASC").fetchall()
    conn.close()
    return jsonify([{
        'id': t['id'],
        'name': t['name'],
        'date': t['date'],
        'priority': t['priority'],
        'category': t['category'],
        'notes': t['notes'],
        'done': bool(t['done']),
        'author': t['author'],
    } for t in tasks])


@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO tasks (name, date, priority, category, notes, author) VALUES (?, ?, ?, ?, ?, ?)",
        (
            data['name'],
            data['date'],
            data.get('priority', 'media'),
            data.get('category', 'otro'),
            data.get('notes', ''),
            data.get('author', ''),
        )
    )
    conn.commit()
    task_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': task_id, 'ok': True}), 201


@app.route('/api/tasks/<int:task_id>', methods=['PATCH'])
def update_task(task_id):
    data = request.json
    conn = get_db()
    if 'done' in data:
        conn.execute("UPDATE tasks SET done = ?, updated_at = datetime('now') WHERE id = ?",
                      (1 if data['done'] else 0, task_id))
    if 'name' in data:
        conn.execute("UPDATE tasks SET name = ?, updated_at = datetime('now') WHERE id = ?",
                      (data['name'], task_id))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = get_db()
    conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ============================================================
# WEATHER HISTORY API
# ============================================================
@app.route('/api/weather', methods=['GET'])
def get_weather_history():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM weather_history ORDER BY date DESC LIMIT 90"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/weather', methods=['POST'])
def save_weather():
    data = request.json
    conn = get_db()
    conn.execute("""
        INSERT OR REPLACE INTO weather_history (date, temp, temp_max, temp_min, humidity, rain, wind, weather_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data['date'], data.get('temp'), data.get('temp_max'), data.get('temp_min'),
        data.get('humidity'), data.get('rain'), data.get('wind'), data.get('weather_code'),
    ))
    conn.commit()
    conn.close()
    return jsonify({'ok': True}), 201


# ============================================================
# RUN
# ============================================================
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
