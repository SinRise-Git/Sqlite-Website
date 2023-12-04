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
  response.sendFile(path.join(public, '/medlem-page.html'));
});

app.use(express.static(staticPath));


function insertUser(name, password, userType, role, kompani, telephone, uuid, gender) {
    const sql = db.prepare("INSERT INTO users (name, password, userType, role, kompani, userStatus, uuid, telefon, gender) values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    const info = sql.run(name, password, userType, role, kompani, "False", uuid, telephone, gender)
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

function removeKompanis(removeKompanis){ 
    const sql = db.prepare("DELETE FROM kompanier WHERE kompani = ?");
    const info = sql.run(removeKompanis)    
}

app.post("/createUser", createUsers)

app.get("/getRole", getRoles)

app.get("/getKompani", getKompanis)

app.get("/getChild", getChilds)

app.get("/getUsersAdmin", getUsersAdmins)

app.post("/deleteUser", deleteUsers)

app.put("/activateUser", activateUsers)

app.post("/createKompani", createKompanis)

app.post("/deleteKompani", deleteKompanis)

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

async function createKompanis(request){
    const user = request.body
    addKompani(user.newKompani)
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
        SELECT users.name, users.userType, roler.roles, kompanier.kompani, users.userStatus, users.telefon, users.gender 
        FROM users 
        INNER JOIN kompanier ON users.kompani = kompanier.id 
        INNER JOIN roler ON users.role = roler.id 
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
    const sql = db.prepare("SELECT ID, kompani FROM kompanier WHERE kompanier.kompani != 'Empty'");
    let rows = sql.all();
    let kompanis = rows.map(kompani => ({
        id: kompani.ID,
        kompani: kompani.kompani
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
        insertUser(user.name, hashPassword, user.userType, user.role, user.kompani, user.telephone, UUID, user.gender);
        response.send({ redirectUrl: `/login-page.html` });
    }
    
}

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000/login-page.html");
});

