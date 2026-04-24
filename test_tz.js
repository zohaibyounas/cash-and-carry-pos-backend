const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Karachi");

const d1 = moment('2026-04-23').startOf('day').toDate();
const d2 = moment('2026-04-23').endOf('day').toDate();

console.log('Start (PKT 00:00):', d1.toISOString());
console.log('End (PKT 23:59):', d2.toISOString());

const saleDate = new Date('2026-04-23T18:39:17.592Z');
console.log('Sale Date (UTC):', saleDate.toISOString());
console.log('Is in range?', saleDate >= d1 && saleDate <= d2);
