const express = require("express")
const path = require("path")
const sqlite3 = require('better-sqlite3')
const bcrypt = require('bcrypt')
const dotenv = require('dotenv')
const session = require("express-session")
const uuid = require('uuid')    

dotenv.config();


const app = express();
const staticPath = path.join(__dirname, 'public')
const db = sqlite3('./users.db', { verbose: console.log })
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))

const checkAuthorization = (allowedRoles) => {
    return (request, response, next) => {
      if (!request.session.loggedIn) {
        return response.redirect('/login-page.html');
      }
      if (!allowedRoles.includes(request.session.loggedIn)) {
        return response.status(403).send('Forbidden');
      }
      next();
    };
  };
   
app.get('/admin-page.html', checkAuthorization(['Admin']), (request, response) => {
  response.sendFile(path.join(staticPath, '/admin-page.html'));
});
   
app.get('/leder-page.html', checkAuthorization(['Leder']), (request, response) => {
  response.sendFile(path.join(staticPath, '/leder-page.html'));
});
   
app.get('/medlem-page.html', checkAuthorization(['Medlem']), (request, response) => {
  response.sendFile(path.join(staticPath, '/medlem-page.html'));
});

app.use(express.static(staticPath));


function insertUser(name, password, userType, role, kompani, peletong, telephone, uuid, gender) {
    const sql = db.prepare("INSERT INTO users (name, password, userType, role, kompani, peletong, userStatus, uuid, telefon, gender) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    const info = sql.run(name, password, userType, role, kompani, peletong, "False", uuid, telephone, gender)
}

function removeUser(name){
    const sql = db.prepare("DELETE FROM users WHERE name = ?");
    const info = sql.run(name)
}

function usableUser(name){
    const sql = db.prepare("UPDATE users SET userStatus = ? WHERE name = ?");
    const info = sql.run("True" , name)
}

function addKompani(newKompani){
    const sql = db.prepare("INSERT INTO kompanier (kompani) values (?)")
    const info = sql.run(newKompani)
}

function addPeletong(newPeletong, kompani) {
    const sql = db.prepare("INSERT INTO peletonger (peletong_navn, kompani_id) values (?, ?)")
    const info = sql.run(newPeletong, kompani)
}

function removeKompanis(removeKompanis){ 
    const sql = db.prepare("DELETE FROM kompanier WHERE kompani = ?");
    const info = sql.run(removeKompanis)    
}

function removePeletongs(removePeletongs){ 
    const sql = db.prepare("DELETE FROM peletonger WHERE peletong_navn = ?");
    const info = sql.run(removePeletongs)    
}


app.post("/createUser", createUsers)

app.get("/getRole", getRoles)

app.get("/getKompani", getKompanis)

app.get("/getChild", getChilds)

app.get("/getPeletong", getPeletongs)

app.get("/getUsersAdmin", getUsersAdmins)

app.post("/deleteUser", deleteUsers)

app.put("/activateUser", activateUsers)

app.post("/createPeletong", createPeletongs)

app.post("/createKompani", createKompanis)

app.post("/deleteKompani", deleteKompanis)

app.post("/deletePeletong", deletePeletongs)

app.post("/loginUser", loginUsers)



async function loginUsers(request, response) {
    const user = request.body;
    const sqlUserType = db.prepare('SELECT userType, uuid, kompani, password, userStatus FROM users WHERE name = ?');
    let rows = sqlUserType.all(user.name);

    if (rows.length === 0) {
        request.session.loggedIn = undefined
        response.send({
            ErrorMessage: `Invalid name or password` 
            
        });
        
    } else {
        const storedUser = rows[0];
        if (storedUser.userStatus !== 'True') {
            request.session.loggedIn = undefined
            response.send({
                ErrorMessage: `Account is not activated yet. Ask the kompani leader to activate it.`
            });
          
        } else {
            bcrypt.compare(user.password, storedUser.password, function (err, result) {
                if (result) {
                    request.session.loggedIn = storedUser.userType;
                    request.session.userUuid = storedUser.uuid
                    response.send({ 
                        redirectUrl: `/${storedUser.userType.toLowerCase()}-page.html`
                    });
                } else {
                    request.session.loggedIn = undefined
                    response.send({
                        ErrorMessage: `Invalid name or password`,          
                    });
                }
            });
        }
    }
}

async function deleteKompanis(request, response) {
    const user = request.body
    removeKompanis(user.kompani)
}

async function deletePeletongs(request, response) {
    const user = request.body
    removePeletongs(user.peletong)
}

async function createKompanis(request, response){
    const user = request.body
    const sql = db.prepare('SELECT kompani FROM kompanier WHERE kompani = ?');
    let rows = sql.all(user.newKompani);
    if (rows.length !== 0){
        response.send({
            ErrorMessage: `There is already a kompani with this name`
        });
    } else {
        addKompani(user.newKompani)
    }
}

async function createPeletongs(request, response){
    const user = request.body
    const sql = db.prepare('SELECT peletong_navn FROM peletonger WHERE peletong_navn = ? AND kompani_id = ?');
    let rows = sql.all(user.newPeletong, user.kompani);
    if (rows.length !== 0){
        response.send({
            ErrorMessage: `There is already a peltong in this kompani with this name`
        });
    } else {
        addPeletong(user.newPeletong, user.kompani)
    }
}

async function activateUsers(request){
    const user = request.body
    usableUser(user.name)
}

async function deleteUsers(request){
    const user = request.body
    removeUser(user.name)
}
async function getUsersAdmins(request, response){
    const sql = db.prepare(`
        SELECT users.name, users.userType, roler.roles, kompanier.kompani, users.userStatus, users.telefon, users.gender, peletonger.peletong_navn 
        FROM users 
        INNER JOIN kompanier ON users.kompani = kompanier.id 
        INNER JOIN roler ON users.role = roler.id 
        INNER JOIN peletonger ON users.peletong = peletonger.id
        WHERE users.userType != 'Admin'; 
    `);
    let rows = sql.all();
    let users = rows.map(user => ({
        name: user.name,
        telephone: user.telefon,
        gender: user.gender,
        userType: user.userType,
        role: user.roles,
        kompani: user.kompani,
        peletong: user.peletong_navn,
        userstatus: user.userStatus
    }));
    response.send(users);
}

async function getRoles(request, response){
    const sql = db.prepare("SELECT ID, roles FROM roler WHERE roler.roles != 'Empty'");
    let rows = sql.all();
    let roles = rows.map(role => ({
        id: role.ID,
        role: role.roles
    }));
    response.send(roles);
}

async function getKompanis(request, response) {
    const sql = db.prepare(`
        SELECT kompanier.ID, kompanier.kompani,
            (SELECT COUNT(DISTINCT peletonger.id) FROM peletonger WHERE peletonger.kompani_id = kompanier.id) AS amountPeletongs,
            (SELECT COUNT(DISTINCT users.id) FROM users WHERE users.kompani = kompanier.id) AS amountUsers
        FROM kompanier
        WHERE kompanier.kompani != 'Empty'
    `);

    let rows = sql.all();
    let kompanis = rows.map(kompani => ({
        id: kompani.ID,
        kompani: kompani.kompani,
        amountPeletongs: kompani.amountPeletongs,
        amountUsers: kompani.amountUsers,
    }));
    response.send(kompanis);
}


async function getChilds(request, response){
    const sql = db.prepare("SELECT name FROM users WHERE userType = 'Medlem'");
    let rows = sql.all();
    let childs = rows.map(child => ({
        child: child.name
    }));
    response.send(childs);
}

async function getPeletongs(request, response) {
    const sql = db.prepare(`
        SELECT peletonger.ID, peletonger.peletong_navn, kompanier.kompani,
            (SELECT COUNT(DISTINCT users.id) FROM users WHERE users.peletong = peletonger.ID) AS amountUsers
        FROM peletonger
        INNER JOIN kompanier ON peletonger.kompani_id = kompanier.id
        WHERE peletonger.kompani_id != '1'
    `);
    
    let rows = sql.all();
    let peletongs = rows.map(peletong => (
        {
            id: peletong.ID,
            peletong: peletong.peletong_navn,
            kompani: peletong.kompani,
            amountUsers: peletong.amountUsers,
        }
    ));
    response.send(peletongs);
}

async function createUsers(request, response) {
    const user = request.body
    const sql = db.prepare('SELECT name FROM users WHERE name = ?');
    let rows = sql.all(user.name);
    if (rows.length !== 0){
        response.send({
            ErrorMessage: `There is already a user with this name`
        });
    } else {
        const hashPassword = bcrypt.hashSync(user.password, 10)
        const UUID = uuid.v4();
        insertUser(user.name, hashPassword, user.userType, user.role, user.kompani, user.peletong, user.telephone, UUID, user.gender, );
        response.send({ redirectUrl: `/login-page.html` });
    }
    
}

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000/login-page.html");
});

