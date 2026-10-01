/**
 * Script kiểm tra thông số mạng: IP LAN, Router Gateway, Public IP và kiểm tra CGNAT
 * Chạy bằng lệnh: node scripts/check-network.cjs
 */
const os = require('os');
const { execSync } = require('child_process');

async function checkNetwork() {
  console.log('====================================================');
  console.log('🔍 KIỂM TRA THÔNG SỐ MẠNG MÁY HOST (SCHOOLJUDGE LAN)');
  console.log('====================================================\n');

  // 1. IP LAN nội bộ
  const interfaces = os.networkInterfaces();
  const lanIps = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        lanIps.push({ name, ip: iface.address, mask: iface.netmask });
      }
    }
  }

  console.log('📌 1. ĐỊA CHỈ IP LAN NỘI BỘ MÁY HOST:');
  lanIps.forEach(item => {
    console.log(`   - Card mạng [${item.name}]: ${item.ip} (Subnet: ${item.mask})`);
  });

  // 2. Gateway Router
  let gateway = '192.168.1.1';
  try {
    const routeOut = execSync('route print 0.0.0.0', { encoding: 'utf8' });
    const match = routeOut.match(/0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match) gateway = match[1];
  } catch (e) {}
  console.log(`\n📌 2. ĐỊA CHỈ ROUTER/GATEWAY PHÒNG MÁY:`);
  console.log(`   - Truy cập trang quản trị Router tại: http://${gateway}`);

  // 3. Public IP ngoài Internet
  console.log(`\n📌 3. ĐỊA CHỈ PUBLIC IP (INTERNET):`);
  let publicIp = 'Không xác định';
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    publicIp = data.ip;
    console.log(`   - Public IP hiện tại: ${publicIp}`);
  } catch (e) {
    console.log('   - Không lấy được Public IP (kiểm tra lại kết nối mạng ra ngoài).');
  }

  // 4. Phân tích CGNAT / Double NAT
  console.log(`\n📌 4. ĐÁNH GIÁ KHẢ NĂNG DÙNG PORT FORWARDING:`);
  try {
    const traceOut = execSync('tracert -d -h 3 8.8.8.8', { encoding: 'utf8', timeout: 8000 });
    const lines = traceOut.split('\n');
    let hasPrivateHop = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('10.') || line.includes('172.16.') || line.includes('100.64.')) {
        hasPrivateHop = true;
        break;
      }
    }

    if (hasPrivateHop) {
      console.log('   ⚠️ CẢNH BÁO: Phát hiện dải IP Private trung gian (Hop 2 / Hop 3).');
      console.log('   -> Trường có thể đang dùng CGNAT nhà mạng hoặc mạng phòng máy nằm sau 2 lớp Router (Double-NAT).');
      console.log('   -> CẦN LƯU Ý: Cần đối chiếu IP WAN trên Modem chính với Public IP ' + publicIp);
      console.log('   -> NẾU DÙNG CGNAT: Khuyến nghị dùng giải pháp Cloudflare Tunnel (xem hướng dẫn đi kèm).');
    } else {
      console.log('   ✅ Tín hiệu tốt: Mạng có thể đang có IP Public trực tiếp trên Modem.');
    }
  } catch (e) {
    console.log('   (Bỏ qua kiểm tra hop trace)');
  }

  console.log('\n====================================================\n');
}

checkNetwork();
