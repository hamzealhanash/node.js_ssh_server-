/**  imports    */
import net = require('net')
import bodyParser = require('body-parser')
import express = require('express')
import ssh = require('ssh2')

/** top level variables   */

const errorPrint = (a: any) => console.error(a),
    print = (a: any) => console.log(a),
    app = express(),
    port = 5000,
    client = ssh.Client
let sshConnections: { [key: string]: { host: string; username: string; connected: boolean; conn: ssh.Client } } = {};

/**  API Server Setup  */
{
    app.use(bodyParser.json())
    app.listen(port, function () {
        print(`running on port http://localhost:${port}`)
    })
}

const connectToSSH = (socket: net.Socket, sshHost: string, sshUsername: string, sshPassword: string, callback: (err: Error | null) => void) => {
    const existingConnection = sshConnections[socket.remoteAddress];

    if (existingConnection && existingConnection.connected) {
        callback(new Error('Already connected to an SSH server.'))
        return
    } else if (sshHost === '') {
        callback(new Error("host name is empty"))
        return
    }

    const connection = new client()
    connection
        .connect({
            port: 22,
            host: sshHost || '',
            username: sshUsername,
            password: sshPassword,
            forceIPv4: true, // Specify IPv4 connection
            readyTimeout: 15000,
        })
        .on('ready', () => {
            sshConnections[socket.remoteAddress] = {
                host: sshHost,
                username: sshUsername,
                connected: true,
                conn: connection,
            }
            print(`SSH connection established to ${sshHost}`)
            callback(null);
        })
        .on('error', (err: Error) => {
            errorPrint(`Error acquired check the logs`);
            callback(err)
        })
}

function handleError(err: any, res: any) {
    console.error('Error:', err);

    if (err.code === 'ECONNREFUSED') {
        res.status(500).send('Connection refused. Please check SSH server availability.');
    } else {
        res.status(500).send('An unexpected error occurred.');
    }
}

// API Endpoints
app.post('/api/command', (req, res: any) => {
    const {command, socketAddress} = req.body;
    const connection = sshConnections[socketAddress]
    print(socketAddress)
    if (!command || typeof command !== 'string') {
        return res.status(400).send('Invalid command format. Please provide a string.')
    }

    if (!(connection || connection.connected)) {
        return res.status(400).send('No active SSH connection for this client.')
    }

    connection.conn.shell((err, stream) => {
        if (err) {
            handleError(err, res); // Handle shell creation error
            return;
        }

        stream.on('data', (data: { toString: () => any }) => {
            print("test")
            print(data)
            res.write(data.toString());
        });

        stream.on('error', (err: any) => {
            handleError(err, res); // Handle errors during command execution
        });

        stream.on('close', () => {
            res.end(); // Signal end of command execution
        });

        stream.write(command + '\n'); // Send command to SSH server
    });
})

app.post('/api/disconnect', (req: { body: { socketAddress: string } }, res: any) => {
    const socketAddress = req.body.socketAddress; // Get socket address from request body

    if (!socketAddress) {
        return res.status(400).send('Missing socket address in request body.');
    }

    const connection = sshConnections[socketAddress]
    if (connection && connection.connected) {
        connection.conn.end(); // Disconnect from SSH server
        connection.connected = false; // Update connection status
        sshConnections[socketAddress] = {host: '', username: '', connected: false, conn: null}
        res.status(200).send('Disconnected from SSH server.');
    } else {
        res.status(404).send('No active connection found for this socket address.');
    }
});
// Assuming you have an API endpoint (/api/connect) to handle connection requests
app.post('/api/connect', (req: { body: { host: any; username: any; password: any } }, res: any) => {
    const {host, username, password} = req.body;
    if (!host) {
        res.status(400).send(`you entered a non-valid hostname: ${host}!`);
        return
    }
    const newSocket = new net.Socket()
    newSocket.connect(22, host).on('connect', () => {
        connectToSSH(newSocket, host, username, password, (err: Error) => {
            if (err) {
                if (err.message === 'All configured authentication methods failed') {
                    res.status(500).send(`Username or Password incorrect`)
                    return
                } else if (err.message === 'Already connected to an SSH server.') {
                    res.status(500).send('already connected')
                    return
                }
            }
            res.status(200).send('SSH connection established.')

        })
    })
})

app.get('/api/status', (req: any, res: any) => {
    const connections = Object.values(sshConnections) // Extract connection details as an array
    const connectionDetails = connections.map((connection) => ({
        host: connection.host,
        username: connection.username,
        connected: connection.connected,
    }));
    if (connections.length === 0) {
        print("No connections found.")
    }
    res.status(200).json(connectionDetails)
})