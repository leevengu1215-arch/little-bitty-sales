const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, {recursive:true});
const DB = path.join(DATA_DIR, 'data.json');
const PUBLIC = path.join(__dirname, 'public');

const products = [];
const add = (name, images, colors, sizes, prices, originalPrices, hidden=false) => colors.forEach(color => sizes.forEach((size, i) => products.push({ id: `p${products.length + 1}`, name, image: images[color], color, size, price: prices[i], originalPrice: originalPrices[i], hidden })));
add('随行垫',{'紫色':'mat-purple.webp','绿色':'mat-green.webp','黄色':'mat-yellow.webp','粉色':'mat-pink.webp'},['紫色','绿色','黄色','粉色'],['S','M','L'],[138,148,158],[178,188,198],true);
add('单色三角巾',{'藏青蓝格子':'triangle-single-navy.webp','雾蓝色格子':'triangle-single-mist.webp','杏粉条纹':'triangle-single-pink.webp','卡其蓝格子':'triangle-single-khaki.webp'},['藏青蓝格子','雾蓝色格子','杏粉条纹','卡其蓝格子'],['S','M','L'],[33,35,37],[42,45,48]);
add('双色三角巾',{'可可咖':'triangle-duo-coffee.webp','红苹果':'triangle-duo-red.webp'},['可可咖','红苹果'],['S','M','L'],[43,45,48],[55,58,61]);
add('单色脖套',{'黄色':'snood-summer-yellow.webp','绿色':'snood-summer-green.webp','粉色':'snood-summer-pink.webp','白色':'snood-summer-white.webp'},['黄色','绿色','粉色','白色'],['S21','M25','L28'],[42,46,50],[59,59,59]);
add('双色脖套',{'可可咖':'snood-duo-coffee.webp','红苹果':'snood-duo-red.webp'},['可可咖','红苹果'],['S21','M25','L28'],[50,56,62],[69,69,69]);
add('小马抱枕',{'棕色':'horse-pillow-brown.webp'},['棕色'],['均码'],[128],[168]);
add('围巾',{'红色':'scarf-red.webp','蓝色':'scarf-blue.webp','咖色':'scarf-coffee.webp'},['红色','蓝色','咖色'],['XS','S','M','L'],[50,53,56,58],[65,68,72,75]);
add('帽子',{'藏青蓝格':'hat-navy.webp','雾蓝色格子':'hat-mist.webp','杏粉条纹':'hat-pink.webp','卡其蓝格子':'hat-khaki.webp'},['藏青蓝格','雾蓝色格子','杏粉条纹','卡其蓝格子'],['XXS','XS','S','M','L'],[50,53,55,58,60],[65,68,71,75,78]);
add('窝垫',{'蓝色':'garden-bed-blue.webp','绿色':'garden-bed-green.webp'},['蓝色','绿色'],['F'],[159],[159]);
add('凉感三角巾',{'紫色':'pcm28-purple.webp','蓝色':'pcm28-blue.webp','黄色':'pcm28-yellow.webp'},['紫色','蓝色','黄色'],['M','L'],[129,129],[129,129]);
add('降温围脖',{'蓝色':'pcm18-blue.webp','黄色':'pcm18-yellow.webp'},['蓝色','黄色'],['F'],[129],[129]);

function load() {
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
  catch { return { products, sales: [] }; }
}
let db = load();
db.products = products.map(p => ({...(db.products || []).find(old => old.id === p.id), ...p}));
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 2));
save();
const clients = new Set();
const broadcast = () => { const msg = `data: ${JSON.stringify({ type: 'refresh' })}\n\n`; clients.forEach(r => r.write(msg)); };
const json = (res, status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); };
const body = req => new Promise((resolve, reject) => { let s=''; req.on('data', c => { s += c; if(s.length > 1e6) reject(Error('请求过大')); }); req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { reject(Error('数据格式错误')); } }); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/events') {
      res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'}); res.write(': connected\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
    }
    if (url.pathname === '/api/state' && req.method === 'GET') return json(res, 200, db);
    if (url.pathname === '/api/sales' && req.method === 'POST') {
      const b = await body(req), product = db.products.find(p => p.id === b.productId), quantity = Number.parseInt(b.quantity, 10), discount = Number(b.discount), price = Number(b.price), note = String(b.note || '').trim().slice(0,200);
      if (!product || !String(b.clerk || '').trim()) return json(res, 400, {error:'请先填写售货员名字'});
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return json(res, 400, {error:'数量必须是 1–99'});
      if (!Number.isFinite(price) || price <= 0 || price > 100000) return json(res, 400, {error:'请输入有效的成交单价'});
      if (![0,5,10].includes(discount) || discount > price * quantity) return json(res, 400, {error:'优惠金额无效'});
      const sale = { id: crypto.randomUUID(), productId: product.id, clerk: String(b.clerk).trim().slice(0,20), price, quantity, discount, note, createdAt: new Date().toISOString(), voidedAt: null };
      db.sales.unshift(sale); save(); broadcast(); return json(res, 201, sale);
    }
    if (url.pathname.startsWith('/api/sales/') && url.pathname.endsWith('/void') && req.method === 'POST') {
      const id = url.pathname.split('/')[3], b = await body(req), sale = db.sales.find(s => s.id === id);
      if (!sale) return json(res, 404, {error:'记录不存在'});
      if (sale.voidedAt) return json(res, 409, {error:'记录已撤回'});
      if (sale.clerk !== String(b.clerk || '').trim()) return json(res, 403, {error:'只能撤回自己的记录'});
      sale.voidedAt = new Date().toISOString(); save(); broadcast(); return json(res, 200, sale);
    }
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file), type = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type':type}); fs.createReadStream(file).pipe(res);
  } catch (e) { json(res, 400, {error:e.message || '请求失败'}); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Little Bitty 销售台已启动：http://localhost:${PORT}`));
