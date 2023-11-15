const express = require("express");
const path = require("path");
const sqlite3 = require('better-sqlite3')
const bcryp = require('bcrypt')

const app = express();
const staticPath = path.join(__dirname, 'public')
const db = sqlite3('./users.db', { verbose: console.log })
app.use(express.static(staticPath));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function insertUser(name, password, parents, userType, role, kompani) {
    const sql = db.prepare("INSERT INTO users (name, password, parents, userType, role, kompani, userStatus) values (?, ?, ?, ?, ?, ?, ?)")
    const info = sql.run(name, password, parents, userType, role, kompani, "False")
}

function removeUser(name){
    const sql = db.prepare("DELETE FROM users WHERE name = ?");
    const info = sql.run(name)
}

function usableUser(name){
    const sql = db.prepare("UPDATE users SET userStatus = ? WHERE name = ?");
    const info = sql.run("True" , name)
}

app.post("/createUser", createUsers);

app.get("/getKompani", getKompanis);

app.get("/getUsersAdmin", getUsersAdmins)

app.post("/deleteUser", deleteUsers)

app.put("/activateUser", activateUsers)


async function activateUsers(request){
    const user = request.body
    usableUser(user.name)
}

async function deleteUsers(request){
    const user = request.body
    removeUser(user.name)
}
async function getUsersAdmins(request, response){
    const sql = db.prepare("SELECT name, parents, userType, role, kompani, userStatus FROM users WHERE userType != 'admin'");
    let rows = sql.all();
    let users = rows.map(user => ({
        name: user.name,
        parents: user.parents,
        userType: user.userType,
        role: user.role,
        kompani: user.kompani,
        userstatus: user.userStatus
    }));
    response.send(users);
}

async function getKompanis(request, response) {
    const sql = db.prepare('SELECT kompani FROM kompanier');
    let rows = sql.all();
    let kompanis = rows.map(kompani => ({
        kompani: kompani.kompani
    }));
    response.send(kompanis);
}

async function createUsers(request) {
    const user = request.body
    const hashPassword = bcryp.hashSync(user.password, 10)
    insertUser(user.name, hashPassword, user.parents, user.userType, user.role, user.kompani);
}

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
