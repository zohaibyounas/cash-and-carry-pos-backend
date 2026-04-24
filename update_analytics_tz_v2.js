const fs = require('fs');
const path = 'c:\\Users\\PMLS\\OneDrive\\Documents\\cash-and_carry_store\\server\\controllers\\analyticsController.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update imports
content = content.replace("const moment = require('moment');", "const moment = require('moment-timezone');");

// 2. Set default timezone at the top
if (!content.includes('moment.tz.setDefault("Asia/Karachi");')) {
    content = content.replace("const moment = require('moment-timezone');", 'const moment = require("moment-timezone");\nmoment.tz.setDefault("Asia/Karachi");');
}

// 3. Update date filter logic to be simpler with timezone set
const pattern = /if \(startDate && endDate\) \{[\s\S]*?\/\/ Adjust for \+05:00 timezone \(PKT\)[\s\S]*?const start = moment\.utc\(startDate\)\.subtract\(5, 'hours'\)\.toDate\(\);[\s\S]*?const end = moment\.utc\(endDate\)\.endOf\('day'\)\.subtract\(5, 'hours'\)\.toDate\(\);[\s\S]*?dateFilter\.createdAt = \{[\s\S]*?\$gte: start,[\s\S]*?\$lte: end[\s\S]*?\};[\s\S]*?\}/g;

content = content.replace(pattern, `if (startDate && endDate) {
            // Using Asia/Karachi default timezone set above
            const start = moment(startDate).startOf('day').toDate();
            const end = moment(endDate).endOf('day').toDate();
            dateFilter.createdAt = {
                $gte: start,
                $lte: end
            };
        }`);

// 4. Update trend date formatting in getDashboardStats
content = content.replace(/const ds = moment\(d\)\.add\(5, 'hours'\)\.format\('YYYY-MM-DD'\);/g, "const ds = moment(d).format('YYYY-MM-DD');");
content = content.replace(/const todayStr = moment\(\)\.format\('YYYY-MM-DD'\);/g, "const todayStr = moment().format('YYYY-MM-DD');");

fs.writeFileSync(path, content, 'utf8');
console.log('Updated analyticsController.js with moment-timezone and Karachi default');
