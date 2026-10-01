const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 41234;

class LanDiscovery {
  constructor() {
    this.serverSocket = null;
    this.clientSocket = null;
    this.broadcastInterval = null;
  }

  getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push({
            name,
            address: iface.address,
            netmask: iface.netmask
          });
        }
      }
    }
    return addresses;
  }

  // Host starts broadcasting beacon to LAN
  startHostBeacon(serverInfo) {
    this.stopHostBeacon();

    try {
      this.serverSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.serverSocket.bind(() => {
        try {
          this.serverSocket.setBroadcast(true);
        } catch (e) {
          console.warn('Could not set broadcast flag:', e.message);
        }

        this.broadcastInterval = setInterval(() => {
          const ips = this.getLocalIPs();
          const primaryIp = ips[0] ? ips[0].address : '127.0.0.1';

          const payload = JSON.stringify({
            app: 'SchoolJudgeLAN',
            name: serverInfo.name || 'Phòng Chấm C++ Nội Bộ',
            ip: primaryIp,
            allIps: ips.map(i => i.address),
            port: serverInfo.port || 4000,
            timestamp: Date.now()
          });

          const message = Buffer.from(payload);
          // Broadcast to LAN subnet
          this.serverSocket.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255', (err) => {
            if (err) {
              // Ignore broadcast routing errors on non-routed virtual adapters
            }
          });
        }, 2000);
      });
    } catch (err) {
      console.error('LAN Beacon error:', err);
    }
  }

  stopHostBeacon() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    if (this.serverSocket) {
      try { this.serverSocket.close(); } catch (e) {}
      this.serverSocket = null;
    }
  }

  // Student listens for active Host servers in LAN
  startDiscoveryListener(onServerFound) {
    this.stopDiscoveryListener();

    try {
      this.clientSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.clientSocket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.app === 'SchoolJudgeLAN') {
            onServerFound({
              ...data,
              discoveredIp: rinfo.address,
              lastSeen: Date.now()
            });
          }
        } catch (e) {}
      });

      this.clientSocket.bind(DISCOVERY_PORT);
    } catch (err) {
      console.warn('UDP Discovery listener bind failed:', err.message);
    }
  }

  stopDiscoveryListener() {
    if (this.clientSocket) {
      try { this.clientSocket.close(); } catch (e) {}
      this.clientSocket = null;
    }
  }
}

module.exports = new LanDiscovery();
