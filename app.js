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
app.use(express.static(staticPath));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))

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

app.get("/getKompani", getKompanis)

app.get("/getChild", getChilds)

app.get("/getUsersAdmin", getUsersAdmins)

app.post("/deleteUser", deleteUsers)

app.put("/activateUser", activateUsers)

app.post("/createKompani", createKompanis)

app.post("/deleteKompani", deleteKompanis)

app.post("/loginUser", loginUsers)

app.get("/getSession" , getSessions)

app.get("/checkLoginAdmin", checkLoginAdmin)


async function loginUsers(request, response) {
    const user = request.body;
    const sqlUserType = db.prepare('SELECT userType, kompani, password, userStatus FROM users WHERE name = ?');
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

async function getSessions(request, response){
    console.log(request.session.loggedIn)
}

async function checkLoginAdmin (request, response){
    if (request.session.loggedIn === undefined)   {
        console.log("You are not ment to be here")
    } else {
        console.log("You can be here")
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
    const sql = db.prepare("SELECT name, userType, role, kompani, userStatus, telefon, gender FROM users WHERE userType != 'Admin'");
    let rows = sql.all();
    let users = rows.map(user => ({
        name: user.name,
        telephone: user.telefon,
        gender: user.gender,
        userType: user.userType,
        role: user.role,
        kompani: user.kompani,
        userstatus: user.userStatus
    }));
    response.send(users);
}

async function getKompanis(request, response) {
    const sql = db.prepare('SELECT ID, kompani FROM kompanier');
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
