"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**  imports    */
var net = require("net");
var bodyParser = require("body-parser");
var express = require("express");
var ssh = require("ssh2");
/** top level variables   */
var sshConnections = {};
var errorPrint = function (a) { return console.error(a); }, print = function (a) { return console.log(a); }, app = express(), port = 5000, client = ssh.Client;
/**  api  server special variables   */
{
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.listen(port, function () {
        print("running on port http://localhost:".concat(port));
    });
}
var connectToSSH = function (socket, sshHost, sshUsername, sshPassword, callback) {
    var existingConnection = sshConnections[socket.remoteAddress];
    // Check for existing connection
    if (existingConnection && existingConnection.connected) {
        callback(new Error('Already connected to an SSH server.'));
        return; // Abort connection attempt
    }
    var connection = new client();
    connection
        .connect({
        port: 22,
        host: sshHost || '',
        username: sshUsername,
        password: sshPassword,
        forceIPv4: true, // Specify IPv4 connection
        readyTimeout: 15000,
        sock: socket,
    })
        .on('ready', function () {
        sshConnections[socket.remoteAddress] = {
            host: sshHost,
            username: sshUsername,
            connected: true,
        };
        print("SSH connection established to ".concat(sshHost));
        callback(null);
    })
        .on('error', function (err) {
        errorPrint("Error acquired check the logs");
        callback(err);
    });
};
/*
// API Endpoints
app.post('/api/command', (req: { body: { command: any } }, res: any) => {

})

app.post('/api/disconnect', (req, res: any) => {

})*/
// Assuming you have an API endpoint (/api/connect) to handle connection requests
app.post('/api/connect', function (req, res) {
    var _a = req.body, host = _a.host, username = _a.username, password = _a.password;
    if (!host) {
        res.status(403).send("you entered a non-valid hostname: ".concat(host, "!"));
        return;
    }
    var newSocket = new net.Socket();
    newSocket.connect(22, host).on('connect', function () {
        connectToSSH(newSocket, host, username, password, function (err) {
            if (err) {
                if (err.message === 'All configured authentication methods failed') {
                    res.status(500).send("Username or Password incorrect");
                    return;
                }
                else if (err.message === 'Already connected to an SSH server.') {
                    res.status(500).send('already connected');
                    return;
                }
            }
            res.status(200).send('SSH connection established.');
        });
    });
});
app.get('/api/status', function (req, res) {
    var connections = Object.values(sshConnections); // Extract connection details as an array
    if (connections.length === 0) {
        print("No connections found.");
    }
    res.status(200).json(connections); // Return JSON response with connection info
});
/*connection.shell((stream: any) => {

    sshConnections[socket.remoteAddress] = {connection, stream}; // Store connection after successful establishment
    socket.on('data', (data) => {
        if (sshConnections[address]) sshConnections[address].stream.write(data);
    });
    stream.on('data', (data: string | Uint8Array) => {
        socket.write(data)
    }).on('close', () => {
        print(`SSH connection to ${sshHost} closed for client: ${address}`);
        socket.end();
        delete sshConnections[address]; // Remove connection
    })

})*/ 
