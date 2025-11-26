// ------------------------------
//     ANTI-CRASH (LOGGING)
// ------------------------------
process.on('uncaughtException', (err) => {
    console.error('!!! UNCAUGHT EXCEPTION !!!');
    console.error(err);
});
process.on('unhandledRejection', (reason) => {
    console.error('!!! UNHANDLED REJECTION !!!');
    console.error(reason);
});

// ------------------------------
//     IMPORTOK
// ------------------------------
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
const MySQLStore = require('express-mysql-session')(session);

const app = express();

// ------------------------------
//     KONFIG
// ------------------------------
const PORT = 4130;
const APP_PATH = '/app130';
const DB_USER = 'studb130';
const DB_PASS = 'abc123';
const DB_NAME = 'db130';

// ------------------------------
//     MYSQL POOL (ASYNC/AWAIT)
// ------------------------------
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// ------------------------------
//     SESSION STORE MYSQL-BŐL
// ------------------------------
const sessionStore = new MySQLStore({
    expiration: 1000 * 60 * 60,
    endConnectionOnClose: false
}, mysql.createPool({
    host: '127.0.0.1',
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME
}));

app.use(session({
    secret: 'titkos-nb1-kulcs',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { maxAge: 3600000 }
}));

// ------------------------------
//     EXPRESS ALAPOK
// ------------------------------
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(APP_PATH, express.static('public'));

app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.basePath = APP_PATH;
    next();
});

// ------------------------------
//     ROUTER
// ------------------------------
const router = express.Router();

// ------------------------------
//     FŐOLDAL
// ------------------------------
router.get('/', (req, res) => {
    res.render('index');
});

// ------------------------------
//     ADATBÁZIS LISTA
// ------------------------------
router.get('/database', async (req, res) => {
    try {
        const sql = `
            SELECT labdarugo.*, klub.csapatnev, poszt.nev AS posztnev 
            FROM labdarugo 
            JOIN klub ON labdarugo.klubid = klub.id 
            JOIN poszt ON labdarugo.posztid = poszt.id 
            ORDER BY labdarugo.ertek DESC
        `;
        const [players] = await pool.query(sql);
        res.render('database', { players });
    } catch (err) {
        console.error(err);
        res.send('Hiba történt');
    }
});

// ------------------------------
//     KAPCSOLAT ÜZENET KÜLDÉS
// ------------------------------
router.get('/contact', (req, res) => {
    res.render('contact', { success: req.query.success });
});

router.post('/contact', async (req, res) => {
    try {
        const { nev, email, uzenet } = req.body;
        await pool.query(
            'INSERT INTO kapcsolat (nev, email, uzenet) VALUES (?, ?, ?)',
            [nev, email, uzenet]
        );
        res.redirect(APP_PATH + '/contact?success=1');
    } catch (err) {
        console.error(err);
        res.send('Hiba történt');
    }
});

// ------------------------------
//     ÜZENETEK LISTA (ADMINNAK)
// ------------------------------
router.get('/messages', async (req, res) => {
    if (!req.session.user) return res.redirect(APP_PATH + '/login');
    const [messages] = await pool.query('SELECT * FROM kapcsolat ORDER BY datum DESC');
    res.render('messages', { messages });
});

// ------------------------------
//     REGISZTRÁCIÓ
// ------------------------------
router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        const [rows] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length > 0)
            return res.render('register', { error: 'Foglalt név!' });

        const hashed = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, "user")',
            [username, hashed]
        );

        res.redirect(APP_PATH + '/login');
    } catch (err) {
        console.error(err);
        res.render('register', { error: 'Hiba történt' });
    }
});

// ------------------------------
//     LOGIN
// ------------------------------
router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const [rows] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0)
            return res.render('login', { error: 'Hibás adatok!' });

        const user = rows[0];

        if (!(await bcrypt.compare(password, user.password)))
            return res.render('login', { error: 'Hibás adatok!' });

        req.session.user = user;

        res.redirect(APP_PATH + '/');
    } catch (err) {
        console.error(err);
        res.send('Hiba történt');
    }
});

// ------------------------------
//     LOGOUT
// ------------------------------
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect(APP_PATH + '/');
});

// ------------------------------
//     ADMIN CRUD
// ------------------------------
function isAdmin(req) {
    return req.session.user && req.session.user.role === 'admin';
}

router.get('/admin', async (req, res) => {
    if (!isAdmin(req)) return res.send('Nincs jogosultságod!');
    const [players] = await pool.query(`
        SELECT labdarugo.*, klub.csapatnev, poszt.nev AS posztnev 
        FROM labdarugo 
        LEFT JOIN klub ON labdarugo.klubid = klub.id 
        LEFT JOIN poszt ON labdarugo.posztid = poszt.id 
        ORDER BY labdarugo.id DESC
    `);
    res.render('admin-dash', { players });
});

router.get('/admin/delete/:id', async (req, res) => {
    if (!isAdmin(req)) return res.redirect(APP_PATH + '/login');
    await pool.query('DELETE FROM labdarugo WHERE id = ?', [req.params.id]);
    res.redirect(APP_PATH + '/admin');
});

router.get('/admin/add', async (req, res) => {
    if (!isAdmin(req)) return res.redirect(APP_PATH + '/login');

    const [klubs] = await pool.query('SELECT * FROM klub');
    const [poszts] = await pool.query('SELECT * FROM poszt');

    res.render('player-form', {
        action: 'add',
        player: {},
        klubs,
        poszts
    });
});

router.post('/admin/add', async (req, res) => {
    if (!isAdmin(req)) return res.redirect(APP_PATH + '/login');
    const { vezeteknev, utonev, mezszam, klubid, posztid, ertek, szulido } = req.body;

    await pool.query(
        `INSERT INTO labdarugo 
        (vezeteknev, utonev, mezszam, klubid, posztid, ertek, szulido, magyar, kulfoldi)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [vezeteknev, utonev, mezszam, klubid, posztid, ertek, szulido]
    );

    res.redirect(APP_PATH + '/admin');
});

router.get('/admin/edit/:id', async (req, res) => {
    if (!isAdmin(req)) return res.redirect(APP_PATH + '/login');

    const [player] = await pool.query('SELECT * FROM labdarugo WHERE id = ?', [req.params.id]);
    const [klubs] = await pool.query('SELECT * FROM klub');
    const [poszts] = await pool.query('SELECT * FROM poszt');

    res.render('player-form', {
        action: 'edit',
        player: player[0],
        klubs,
        poszts
    });
});

router.post('/admin/edit/:id', async (req, res) => {
    if (!isAdmin(req)) return res.redirect(APP_PATH + '/login');

    const { vezeteknev, utonev, mezszam, klubid, posztid, ertek, szulido } = req.body;

    await pool.query(
        `UPDATE labdarugo SET 
        vezeteknev=?, utonev=?, mezszam=?, klubid=?, posztid=?, ertek=?, szulido=?
        WHERE id=?`,
        [vezeteknev, utonev, mezszam, klubid, posztid, ertek, szulido, req.params.id]
    );

    res.redirect(APP_PATH + '/admin');
});

// ------------------------------
//     APP START
// ------------------------------
app.use(APP_PATH, router);

app.listen(PORT, () => {
    console.log(`Szerver fut: http://143.47.98.96${APP_PATH}`);
});
