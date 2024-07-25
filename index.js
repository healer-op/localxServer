const net = require('net');
const crypto = require('crypto');

const port = process.env.PORT || 8321;

console.log(`Running on ${port}`)

// const minPort = 8081
// const maxPort = 8181

let pipeSockets = ({ client, tunnel, encKey = null, encIv = null , tunnelPort}) => {
    console.log(`[🟣] Piping Started ${tunnelPort}`);

    if (encKey && encIv) {
        // Transport encryption enabled
        let cipher = crypto.createCipheriv('aes-256-ctr', encKey, encIv);
        let decipher = crypto.createDecipheriv('aes-256-ctr', encKey, encIv);

        cipher.on('data', data => console.log('DATA ENCRYPTED: ', data.length))
        client.pipe(cipher).pipe(tunnel).pipe(decipher).pipe(client);
    } else {
        // Transport encryption disabled
        client.pipe(tunnel).pipe(client);
    }
};

let startTunnel = config => {
    let tunnels = [];
    const waitingClients = [];


    // Tunnel
    net
        .createServer(tunnel => {
            console.log(`[🟢] Tunnel Started at port ${config.tunnelPort}`);
            tunnel.setKeepAlive(true, 2000);
            if (waitingClients.length) {
                pipeSockets({ client: waitingClients.shift(), tunnel, encKey: config.encKey, encIv: config.encIv , tunnelPort: config.tunnelPort});
            } else {
                tunnel.on('data', data => {
                    console.log(`[🟡] Received Data for port ${config.tunnelPort} `, data.toString().length);
                });

                tunnel.on('end', data => {
                    console.log(`[🔴] Tunnel Ended for ${config.tunnelPort}`);
                });

                tunnel.on('error', err => {
                    // console.log(err);
                });

                tunnel.on('close', data => {
                    console.log(`[🔴] Tunnel Closed for ${config.tunnelPort}`);
                    // console.log('pre', tunnels.length);
                    // tunnels = tunnels.filter(_tunnel => _tunnel != tunnel);
                    // console.log('post', tunnels.length);
                });

                tunnels.push(tunnel);
            }
        })
        .listen(config.tunnelPort);

    // Proxy
    net
        .createServer(client => {
            client.setKeepAlive(true);
            client.on('error', (err) => {
                console.log('error handling', err);
            });

            if (tunnels.length) {
                pipeSockets({ client, tunnel: tunnels.shift(), encKey: config.encKey, encIv: config.encIv ,tunnelPort: config.proxyPort});
            } else {
                waitingClients.push(client);
            }
        })
        .listen(config.proxyPort);
};

startTunnel({
    proxyPort: port, // remote port to access exposed local machine (player will connect to this port)
    tunnelPort: port+1 // tunnel port (tcptunnel-client will connect to this port)
});

console.log("SERVER READY")
console.log(`[⚙️] port for tcp client ${port}`)

