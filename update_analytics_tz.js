const fs = require('fs');
const path = 'c:\\Users\\PMLS\\OneDrive\\Documents\\cash-and_carry_store\\server\\controllers\\analyticsController.js';
let content = fs.readFileSync(path, 'utf8');

// Add moment import
if (!content.includes("const moment = require('moment');")) {
    content = "const moment = require('moment');\n" + content;
}

// 1. Centralize Date Filter Logic
// I will replace all instances of the manual date filter with a moment-based one
const dateFilterRegex = /let dateFilter = \{ store: [\w.]+ \};\s+if \(startDate && endDate\) \{[\s\S]*?dateFilter\.createdAt = \{[\s\S]*?\};[\s\S]*?\}/g;

// Actually, it's safer to replace specifically
const pattern = /if \(startDate && endDate\) \{\s+const end = new Date\(endDate\);\s+end\.setHours\(23, 59, 59, 999\);\s+dateFilter\.createdAt = \{\s+\$gte: new Date\(startDate\),\s+\$lte: end\s+\};\s+\}/g;

content = content.replace(pattern, `if (startDate && endDate) {
            // Adjust for +05:00 timezone (PKT)
            const start = moment.utc(startDate).subtract(5, 'hours').toDate();
            const end = moment.utc(endDate).endOf('day').subtract(5, 'hours').toDate();
            dateFilter.createdAt = {
                $gte: start,
                $lte: end
            };
        }`);

// 2. Update Grouping Timezones
// Replace: { format: "%Y-%m-%d", date: "$createdAt" }
// With: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:00" }
content = content.replace(/\{ format: "%Y-%m-%d", date: "\$createdAt" \}/g, '{ format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:00" }');

// Special case for dashboard trend which uses ISOString split
// const ds = d.toISOString().split('T')[0];
// This needs to be local-aware too
content = content.replace(/const ds = d\.toISOString\(\)\.split\('T'\)\[0\];/g, "const ds = moment(d).add(5, 'hours').format('YYYY-MM-DD');");

// Also fix todayStr in dashboard
content = content.replace(/const todayStr = new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];/g, "const todayStr = moment().format('YYYY-MM-DD');");

fs.writeFileSync(path, content, 'utf8');
console.log('Updated analyticsController.js with timezone awareness');
