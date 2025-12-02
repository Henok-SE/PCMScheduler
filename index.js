// index.js - PCM FELLOWSHIP SCHEDULER BOT (FINAL & 100% WORKING)
// ENHANCED: Added complete member management with delete/edit features

require("dotenv").config();
const { Telegraf, session, Markup } = require("telegraf");
const { CronJob } = require("cron");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID);
bot.use(session());

// Create data folder
const dataPath = path.join(__dirname, "data");
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);

const db = new Database(path.join(dataPath, "fellowship.db"));

// CREATE TABLES
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    user_id    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    talents    TEXT NOT NULL DEFAULT '[]',
    registered TEXT DEFAULT CURRENT_TIMESTAMP,
    active     INTEGER DEFAULT 1,
    phone      TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS schedule (
    week   TEXT,
    day    TEXT,
    role   TEXT,
    member TEXT,
    date   TEXT,
    PRIMARY KEY (week, day, role)
  );
`);

// Add columns if missing
try { db.exec("ALTER TABLE members ADD COLUMN active INTEGER DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE members ADD COLUMN phone TEXT DEFAULT ''"); } catch (e) {}

const ROLES = ["Program Leader", "Singer Worshiper", "Preacher", "Keyboardist/Guitarist"];
const DAYS = ["Saturday", "Sunday", "Tuesday"];

// EMOJI MAPPING
const roleEmojis = {
  "Program Leader": "📋",
  "Singer Worshiper": "🎵", 
  "Preacher": "📖",
  "Keyboardist/Guitarist": "🎹"
};

const dayEmojis = {
  "Saturday": "🗓️",
  "Sunday": "🗓️",
  "Tuesday": "🗓️"
};

// KEYBOARDS
function getMainMenu(ctx) {
  const isAdmin = ctx.from?.id === ADMIN_ID;
  const buttons = [
    ["📝 Register", "📅 This Week"],
    ["👤 My Schedule", "📋 Monthly Schedule"],
    ["❓ Help"]
  ];
  if (isAdmin) {
    buttons[1].push("👑 Admin");
  }
  return Markup.keyboard(buttons).resize();
}

function getAdminPanelKeyboard() {
  return Markup.keyboard([
    ["📊 View Members", "👥 Manage Members"],
    ["🔄 Regenerate Schedule", "📅 Force Reminder"],
    ["📣 Announce to All", "📊 Statistics"],
    ["⚙️ Settings", "🔙 Main Menu"]
  ]).resize();
}

function getMemberManagementKeyboard() {
  return Markup.keyboard([
    ["❌ Delete Member", "✏️ Edit Member"],
    ["📞 Add Phone", "✅❌ Toggle Active"],
    ["📋 Member Details", "🔙 Admin Panel"]
  ]).resize();
}

function getTalentKeyboard(selected = []) {
  const rows = ROLES.map(role => {
    const isSelected = selected.includes(role);
    const emoji = isSelected ? "✅" : "⬜";
    return [Markup.button.callback(`${emoji} ${roleEmojis[role]} ${role}`, `talent_${role}`)];
  });
  rows.push([Markup.button.callback("🎯 DONE - Finish Registration", "talent_done")]);
  return Markup.inlineKeyboard(rows);
}

// DATE HELPERS
function getNextSaturday() {
  const today = new Date();
  const diff = (6 - today.getDay() + 7) % 7 || 7;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  return next;
}

function formatDate(date) {
  const d = new Date(date);
  const options = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' };
  return d.toLocaleDateString("en-GB", options);
}

function formatDateLong(date) {
  const d = new Date(date);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", 
                  "August", "September", "October", "November", "December"];
  
  const dayName = days[d.getUTCDay()];
  const day = d.getUTCDate();
  const monthName = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  
  return `${dayName} ${day} ${monthName} ${year}`;
}

// GENERATE SCHEDULE
function generateSchedule() {
  const members = db.prepare("SELECT name, talents FROM members WHERE active = 1").all();
  if (members.length === 0) return false;

  db.prepare("DELETE FROM schedule").run();
  const baseSat = getNextSaturday();

  console.log("✅ Generating schedule starting from:", baseSat.toDateString());

  for (let w = 1; w <= 4; w++) {
    const weekStart = new Date(baseSat);
    weekStart.setDate(baseSat.getDate() + (w - 1) * 7);

    DAYS.forEach(day => {
      const d = new Date(weekStart);
      
      if (day === "Sunday") {
        d.setDate(weekStart.getDate() + 1);
      } else if (day === "Tuesday") {
        d.setDate(weekStart.getDate() + 3);
      }
      
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayNum}`;

      let pool = [...members];
      ROLES.forEach(role => {
        const hasRole = pool.filter(m => JSON.parse(m.talents || "[]").includes(role));
        const chosen = hasRole.length > 0 
          ? hasRole[Math.floor(Math.random() * hasRole.length)]
          : pool[Math.floor(Math.random() * pool.length)];

        if (chosen) {
          db.prepare("INSERT OR REPLACE INTO schedule (week, day, role, member, date) VALUES (?, ?, ?, ?, ?)")
            .run(`📅 Week ${w}`, day, role, chosen.name, dateStr);
          pool = pool.filter(m => m.name !== chosen.name);
        }
      });
    });
  }
  
  console.log("✅ Schedule generated successfully!");
  return true;
}

// WEDNESDAY 8AM REMINDER
new CronJob("0 8 * * 3", () => {
  console.log("⏰ Sending Wednesday 8AM reminders...");
  sendWeeklyReminder();
}, null, true, "Africa/Addis_Ababa");

function sendWeeklyReminder() {
  const rows = db.prepare("SELECT * FROM schedule WHERE week = '📅 Week 1' ORDER BY date").all();
  if (rows.length === 0) {
    console.log("📭 No schedule found for reminders");
    return;
  }

  let msg = "⛪ *THIS COMING WEEK'S FELLOWSHIP PROGRAM*\n\n";
  
  const byDay = {};
  rows.forEach(r => {
    if (!byDay[r.date]) byDay[r.date] = [];
    byDay[r.date].push(r);
  });
  
  const sortedDates = Object.keys(byDay).sort();
  
  sortedDates.forEach(dateStr => {
    const dayRows = byDay[dateStr];
    
    msg += `${dayEmojis[dayRows[0].day]} *${formatDateLong(dateStr)}*\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━\n";
    
    dayRows.forEach(r => {
      msg += `${roleEmojis[r.role]} *${r.role}* → 👤 ${r.member}\n`;
    });
    msg += "\n";
  });
  
  msg += "🙏 *Please prepare and be ready to serve!*\n";
  msg += "💫 To God be the glory!";

  const members = db.prepare("SELECT user_id FROM members WHERE active = 1").all();
  let sent = 0;
  members.forEach(m => {
    bot.telegram.sendMessage(m.user_id, msg, { parse_mode: "Markdown" })
      .then(() => sent++)
      .catch(err => console.error(`❌ Failed to send to ${m.user_id}`));
  });
  
  console.log(`✅ Reminders sent to ${sent}/${members.length} members`);
}

// DISPLAY SCHEDULES
function formatThisWeek() {
  const rows = db.prepare("SELECT * FROM schedule WHERE week = '📅 Week 1' ORDER BY date").all();
  if (rows.length === 0) return "📭 *No schedule yet*\n\n👑 Admin must run /schedule";

  let msg = "⛪ *THIS WEEK'S FELLOWSHIP PROGRAM*\n\n";
  
  const byDay = {};
  rows.forEach(r => {
    if (!byDay[r.date]) byDay[r.date] = [];
    byDay[r.date].push(r);
  });
  
  const sortedDates = Object.keys(byDay).sort();
  
  sortedDates.forEach(dateStr => {
    const dayRows = byDay[dateStr];
    
    msg += `${dayEmojis[dayRows[0].day]} *${formatDateLong(dateStr)}*\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━\n";
    
    dayRows.forEach(r => {
      msg += `${roleEmojis[r.role]} *${r.role}* → 👤 ${r.member}\n`;
    });
    msg += "\n";
  });
  
  msg += "🙏 *Let's serve with excellence!*";
  return msg;
}

function formatMonthlySchedule() {
  const rows = db.prepare("SELECT * FROM schedule ORDER BY date").all();
  if (rows.length === 0) return "📭 *No monthly schedule yet*\n\n👑 Ask admin to run /schedule";

  let msg = "📊 *FULL MONTHLY FELLOWSHIP SCHEDULE*\n\n";
  
  const byWeek = {};
  rows.forEach(r => {
    if (!byWeek[r.week]) byWeek[r.week] = {};
    if (!byWeek[r.week][r.date]) byWeek[r.week][r.date] = [];
    byWeek[r.week][r.date].push(r);
  });
  
  Object.keys(byWeek).sort().forEach(week => {
    const weekRows = byWeek[week];
    const dates = Object.keys(weekRows).sort();
    const start = new Date(dates[0]);
    const end = new Date(dates[dates.length - 1]);
    
    msg += `\n${week} *(${formatDate(start)} - ${formatDate(end)})*\n`;
    msg += "══════════════════════════════\n";
    
    dates.forEach(dateStr => {
      const dayRows = weekRows[dateStr];
      const dayName = dayRows[0].day;
      
      msg += `\n${dayEmojis[dayName]} ${formatDate(dateStr)}\n`;
      msg += "────────────────────\n";
      
      dayRows.forEach(r => {
        const paddedRole = r.role.padEnd(25);
        msg += `${roleEmojis[r.role]} ${paddedRole} → 👤 ${r.member}\n`;
      });
    });
  });
  
  msg += "\n🌟 *To God be all the glory!*";
  return msg;
}

// ========== BOT COMMANDS ==========

// START COMMAND
bot.start(ctx => {
  const isAdmin = ctx.from.id === ADMIN_ID;
  ctx.replyWithMarkdown(`
✨ *WELCOME TO PCM FELLOWSHIP SCHEDULER!* ✨

${isAdmin ? '👑 *You are logged in as ADMIN* 👑\n' : ''}

⛪ *3 Programs Every Week*
• 🗓️ Saturday (Evening) 
• 🗓️ Sunday (Morning)
• 🗓️ Tuesday (Evening)

🎭 *4 Ministry Roles* (Multiple OK!)
• 📋 Program Leader
• 🎵 Singer Worshiper  
• 📖 Preacher
• 🎹 Keyboardist/Guitarist

👇 *Click a button below to begin*`, getMainMenu(ctx));
});

// REGISTRATION
bot.hears("📝 Register", ctx => {
  if (db.prepare("SELECT 1 FROM members WHERE user_id = ?").get(ctx.from.id)) {
    return ctx.replyWithMarkdown("✅ *You are already registered!*\n\n👉 Use *👤 My Schedule*", getMainMenu(ctx));
  }
  ctx.replyWithMarkdown("👋 *Welcome to Registration!*\n\n📝 Please enter your *full name*:", Markup.forceReply());
  ctx.session = { step: "name", talents: [] };
});

// VIEW SCHEDULES
bot.hears("📅 This Week", ctx => ctx.replyWithMarkdown(formatThisWeek(), getMainMenu(ctx)));
bot.hears("📋 Monthly Schedule", ctx => ctx.replyWithMarkdown(formatMonthlySchedule(), getMainMenu(ctx)));

bot.hears("👤 My Schedule", ctx => {
  const member = db.prepare("SELECT name FROM members WHERE user_id = ?").get(ctx.from.id);
  if (!member) return ctx.replyWithMarkdown("📝 *Please register first*", getMainMenu(ctx));

  const rows = db.prepare("SELECT week, day, role, date FROM schedule WHERE member = ? ORDER BY date").all(member.name);
  if (rows.length === 0) return ctx.replyWithMarkdown("📭 *No roles assigned yet*", getMainMenu(ctx));

  let msg = `👤 *YOUR ROLES – ${member.name.toUpperCase()}*\n\n`;
  
  const byWeek = {};
  rows.forEach(r => {
    if (!byWeek[r.week]) byWeek[r.week] = [];
    byWeek[r.week].push(r);
  });
  
  Object.keys(byWeek).sort().forEach(week => {
    msg += `\n${week}\n`;
    msg += "────────────────────\n";
    
    byWeek[week].forEach(r => {
      msg += `${dayEmojis[r.day]} ${formatDate(r.date)}\n`;
      msg += `   ${roleEmojis[r.role]} *${r.role}*\n\n`;
    });
  });
  
  msg += "🙏 *Be prepared to serve!*";
  ctx.replyWithMarkdown(msg, getMainMenu(ctx));
});

// ADMIN PANEL
bot.hears("👑 Admin", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const stats = {
    total: db.prepare("SELECT COUNT(*) as count FROM members").get().count,
    active: db.prepare("SELECT COUNT(*) as count FROM members WHERE active = 1").get().count,
    schedule: db.prepare("SELECT COUNT(*) as count FROM schedule").get().count
  };
  
  ctx.replyWithMarkdown(`
👑 *ADMIN CONTROL PANEL*

📊 *Statistics:*
• 👥 Total Members: ${stats.total}
• ✅ Active Members: ${stats.active}
• ❌ Inactive Members: ${stats.total - stats.active}
• 📅 Scheduled Roles: ${stats.schedule}

🔧 *Admin Functions:*
• 📊 View Members - See all members
• 👥 Manage Members - Delete/Edit members
• 🔄 Regenerate Schedule - Create new schedule
• 📅 Force Reminder - Send reminder now
• 📣 Announce to All - Send message to everyone
• 📊 Statistics - Detailed statistics
• ⚙️ Settings - Bot settings
• 🔙 Main Menu - Return to main menu

👇 *Select an option:*`, getAdminPanelKeyboard());
});

// ADMIN: VIEW MEMBERS
bot.hears("📊 View Members", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const members = db.prepare("SELECT name, talents, active, phone FROM members ORDER BY name").all();
  if (members.length === 0) {
    return ctx.replyWithMarkdown("📭 *No members registered yet*", getAdminPanelKeyboard());
  }
  
  let msg = `📊 *ALL MEMBERS* (${members.length})\n\n`;
  members.forEach((m, i) => {
    const status = m.active ? "✅" : "❌";
    const talents = JSON.parse(m.talents || "[]").map(t => roleEmojis[t] + " " + t).join(", ");
    const phone = m.phone ? `📞 ${m.phone}` : "";
    msg += `${status} *${m.name}*\n`;
    if (talents) msg += `   🎭 ${talents}\n`;
    if (phone) msg += `   ${phone}\n`;
    if (i < members.length - 1) msg += "\n";
  });
  
  ctx.replyWithMarkdown(msg, getAdminPanelKeyboard());
});

// ADMIN: MANAGE MEMBERS (NEW!)
bot.hears("👥 Manage Members", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  ctx.replyWithMarkdown(`
👥 *MEMBER MANAGEMENT*

🔧 *Available Actions:*
• ❌ *Delete Member* - Remove unwanted member
• ✏️ *Edit Member* - Change name or talents
• 📞 *Add Phone* - Add phone number to member
• ✅❌ *Toggle Active* - Activate/deactivate member
• 📋 *Member Details* - View full member info
• 🔙 *Admin Panel* - Return to admin panel

⚠️ *Note:* Deleting a member will remove them from future schedules but not from existing schedules.`, getMemberManagementKeyboard());
});

// ADMIN: DELETE MEMBER
bot.hears("❌ Delete Member", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const members = db.prepare("SELECT name FROM members ORDER BY name").all();
  if (members.length === 0) {
    return ctx.replyWithMarkdown("📭 *No members to delete*", getMemberManagementKeyboard());
  }
  
  let msg = "❌ *SELECT MEMBER TO DELETE*\n\n";
  msg += "⚠️ *Warning: This action cannot be undone!*\n\n";
  msg += "*Available members:*\n";
  
  const keyboard = [];
  members.forEach((m, i) => {
    msg += `${i+1}. ${m.name}\n`;
    keyboard.push([Markup.button.callback(`🗑️ ${m.name}`, `delete_${m.name}`)]);
  });
  
  keyboard.push([Markup.button.callback("🔙 Cancel", "manage_back")]);
  
  ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(keyboard));
});

// ADMIN: EDIT MEMBER
bot.hears("✏️ Edit Member", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const members = db.prepare("SELECT name FROM members ORDER BY name").all();
  if (members.length === 0) {
    return ctx.replyWithMarkdown("📭 *No members to edit*", getMemberManagementKeyboard());
  }
  
  let msg = "✏️ *SELECT MEMBER TO EDIT*\n\n";
  msg += "*Available members:*\n";
  
  const keyboard = [];
  members.forEach((m, i) => {
    msg += `${i+1}. ${m.name}\n`;
    keyboard.push([Markup.button.callback(`✏️ ${m.name}`, `edit_select_${m.name}`)]);
  });
  
  keyboard.push([Markup.button.callback("🔙 Cancel", "manage_back")]);
  
  ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(keyboard));
});

// ADMIN: ADD PHONE
bot.hears("📞 Add Phone", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const members = db.prepare("SELECT name, phone FROM members ORDER BY name").all();
  if (members.length === 0) {
    return ctx.replyWithMarkdown("📭 *No members to add phone*", getMemberManagementKeyboard());
  }
  
  let msg = "📞 *ADD/UPDATE PHONE NUMBER*\n\n";
  msg += "*Select member:*\n";
  
  const keyboard = [];
  members.forEach(m => {
    const phoneStatus = m.phone ? `✅ ${m.phone}` : "❌ No phone";
    keyboard.push([Markup.button.callback(`${m.name} - ${phoneStatus}`, `phone_${m.name}`)]);
  });
  
  keyboard.push([Markup.button.callback("🔙 Cancel", "manage_back")]);
  
  ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(keyboard));
});

// ADMIN: TOGGLE ACTIVE
bot.hears("✅❌ Toggle Active", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const members = db.prepare("SELECT name, active FROM members ORDER BY name").all();
  if (members.length === 0) {
    return ctx.replyWithMarkdown("📭 *No members to manage*", getMemberManagementKeyboard());
  }
  
  let msg = "✅❌ *TOGGLE MEMBER ACTIVE STATUS*\n\n";
  msg += "✅ = Active, ❌ = Inactive\n\n";
  
  const keyboard = [];
  members.forEach(m => {
    const status = m.active ? "✅" : "❌";
    keyboard.push([Markup.button.callback(`${status} ${m.name}`, `toggle_${m.name}`)]);
  });
  
  keyboard.push([Markup.button.callback("🔙 Cancel", "manage_back")]);
  
  ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(keyboard));
});

// ADMIN: MEMBER DETAILS
bot.hears("📋 Member Details", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const members = db.prepare("SELECT name FROM members ORDER BY name").all();
  if (members.length === 0) {
    return ctx.replyWithMarkdown("📭 *No members to view*", getMemberManagementKeyboard());
  }
  
  let msg = "📋 *VIEW MEMBER DETAILS*\n\n";
  msg += "*Select member:*\n";
  
  const keyboard = [];
  members.forEach((m, i) => {
    msg += `${i+1}. ${m.name}\n`;
    keyboard.push([Markup.button.callback(`👤 ${m.name}`, `details_${m.name}`)]);
  });
  
  keyboard.push([Markup.button.callback("🔙 Cancel", "manage_back")]);
  
  ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(keyboard));
});

// ADMIN: REGENERATE SCHEDULE
bot.hears("🔄 Regenerate Schedule", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  ctx.replyWithMarkdown("🔄 *Regenerating schedule...*");
  const success = generateSchedule();
  
  if (success) {
    const stats = {
      total: db.prepare("SELECT COUNT(*) as count FROM members").get().count,
      active: db.prepare("SELECT COUNT(*) as count FROM members WHERE active = 1").get().count,
      schedule: db.prepare("SELECT COUNT(*) as count FROM schedule").get().count
    };
    
    ctx.replyWithMarkdown(`
✅ *Schedule regenerated successfully!*

📊 *New Schedule Details:*
• Total assignments: ${stats.schedule}
• Active members: ${stats.active}
• Total members: ${stats.total}
• Next reminder: Wednesday 8:00 AM

👉 Check *📅 This Week* or *📋 Monthly Schedule*`, getAdminPanelKeyboard());
  } else {
    ctx.replyWithMarkdown("❌ *Need at least 1 active member*", getAdminPanelKeyboard());
  }
});

// ADMIN: FORCE REMINDER
bot.hears("📅 Force Reminder", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  ctx.replyWithMarkdown("⏰ *Sending reminder to all active members...*");
  
  const scheduleCount = db.prepare("SELECT COUNT(*) as count FROM schedule WHERE week = '📅 Week 1'").get().count;
  if (scheduleCount === 0) {
    return ctx.replyWithMarkdown("❌ *No schedule found. Generate schedule first.*", getAdminPanelKeyboard());
  }
  
  sendWeeklyReminder();
  
  const activeCount = db.prepare("SELECT COUNT(*) as count FROM members WHERE active = 1").get().count;
  ctx.replyWithMarkdown(`✅ *Reminder sent to ${activeCount} active members!*`, getAdminPanelKeyboard());
});

// ADMIN: ANNOUNCE TO ALL
bot.hears("📣 Announce to All", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  ctx.replyWithMarkdown("📝 *Send your announcement message:*\n\n*(It will be sent to all active members)*", Markup.forceReply());
  ctx.session = { step: "announcement" };
});

// ADMIN: STATISTICS
bot.hears("📊 Statistics", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const totalMembers = db.prepare("SELECT COUNT(*) as count FROM members").get().count;
  const activeMembers = db.prepare("SELECT COUNT(*) as count FROM members WHERE active = 1").get().count;
  const scheduleCount = db.prepare("SELECT COUNT(*) as count FROM schedule").get().count;
  const week1Count = db.prepare("SELECT COUNT(*) as count FROM schedule WHERE week = '📅 Week 1'").get().count;
  const withPhone = db.prepare("SELECT COUNT(*) as count FROM members WHERE phone != ''").get().count;
  
  let msg = `📊 *BOT STATISTICS*\n\n`;
  msg += `👥 *Members*\n`;
  msg += `• Total: ${totalMembers}\n`;
  msg += `• Active: ${activeMembers}\n`;
  msg += `• Inactive: ${totalMembers - activeMembers}\n`;
  msg += `• With Phone: ${withPhone}\n\n`;
  
  msg += `📅 *Schedule*\n`;
  msg += `• Total assignments: ${scheduleCount}\n`;
  msg += `• This week assignments: ${week1Count}\n\n`;
  
  msg += `⏰ *Next Events*\n`;
  msg += `• Next Saturday: ${formatDateLong(getNextSaturday())}\n`;
  msg += `• Next reminder: Wednesday 8:00 AM\n\n`;
  
  msg += `💾 *Database*\n`;
  msg += `• Location: data/fellowship.db\n`;
  msg += `• Size: ${fs.existsSync(path.join(dataPath, "fellowship.db")) ? Math.round(fs.statSync(path.join(dataPath, "fellowship.db")).size / 1024) : 0} KB`;
  
  ctx.replyWithMarkdown(msg, getAdminPanelKeyboard());
});

// ADMIN: SETTINGS
bot.hears("⚙️ Settings", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  
  const keyboard = [
    [Markup.button.callback("🗑️ Clear Database", "clear_db")],
    [Markup.button.callback("📤 Export Data", "export_data")],
    [Markup.button.callback("🔙 Back", "settings_back")]
  ];
  
  ctx.replyWithMarkdown(`
⚙️ *BOT SETTINGS*

🔧 *Available Options:*
• 🗑️ *Clear Database* - Reset all data
• 📤 *Export Data* - Export members data
• 🔙 *Back* - Return to admin panel

⚠️ *Warning: Clearing database cannot be undone!*`, Markup.inlineKeyboard(keyboard));
});

// ADMIN: BACK TO MAIN MENU
bot.hears("🔙 Main Menu", ctx => {
  ctx.replyWithMarkdown("🔙 *Returning to main menu...*", getMainMenu(ctx));
});

// BACK TO ADMIN PANEL
bot.hears("🔙 Admin Panel", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("👑 Admin only");
  ctx.replyWithMarkdown("🔙 *Returning to admin panel...*", getAdminPanelKeyboard());
});

// HELP
bot.hears("❓ Help", ctx => {
  const isAdmin = ctx.from.id === ADMIN_ID;
  let msg = `❓ *PCM FELLOWSHIP BOT HELP*\n\n`;
  
  msg += `👇 *Main Menu Buttons:*\n`;
  msg += `• 📝 *Register* – Join & select talents\n`;
  msg += `• 📅 *This Week* – Current week only\n`;
  msg += `• 📋 *Monthly Schedule* – Full 4 weeks with dates\n`;
  msg += `• 👤 *My Schedule* – Your personal roles\n`;
  
  if (isAdmin) {
    msg += `• 👑 *Admin* – Administration tools\n`;
  }
  
  msg += `• ❓ *Help* – This message\n\n`;
  
  msg += `⏰ *Automatic Reminders*\n`;
  msg += `• Every *Wednesday 8:00 AM*\n`;
  msg += `• Shows upcoming *Saturday, Sunday, Tuesday* programs\n\n`;
  
  msg += `📅 *Fellowship Days:*\n`;
  msg += `• Saturday Evening\n`;
  msg += `• Sunday Morning\n`;
  msg += `• Tuesday Evening\n\n`;
  
  ctx.replyWithMarkdown(msg, getMainMenu(ctx));
});

// ========== REGISTRATION FLOW ==========
bot.on("text", ctx => {
  if (!ctx.session?.step || ctx.message.text.startsWith("/")) return;
  
  if (ctx.session.step === "name") {
    const name = ctx.message.text.trim();
    if (name.length < 2) return ctx.reply("❌ Name too short!", Markup.forceReply());
    ctx.session.name = name;
    ctx.replyWithMarkdown(`👋 *Nice to meet you, ${name}!*\n\n🎭 *Select your talents:*\n(Tap to choose multiple)`, getTalentKeyboard());
    ctx.session.step = "talents";
  } 
  else if (ctx.session.step === "announcement" && ctx.from.id === ADMIN_ID) {
    const message = ctx.message.text.trim();
    if (message.length < 2) return ctx.reply("❌ Message too short!", Markup.forceReply());
    
    const members = db.prepare("SELECT user_id FROM members WHERE active = 1").all();
    let sent = 0;
    
    members.forEach(m => {
      bot.telegram.sendMessage(m.user_id, `📢 *ANNOUNCEMENT FROM ADMIN*\n\n${message}\n\n🙏 To God be the glory!`, { parse_mode: "Markdown" })
        .then(() => sent++)
        .catch(() => {});
    });
    
    ctx.replyWithMarkdown(`📢 *Announcement sent to ${sent}/${members.length} active members!*`, getAdminPanelKeyboard());
    delete ctx.session.step;
  }
  else if (ctx.session.step === "edit_name" && ctx.from.id === ADMIN_ID) {
    const newName = ctx.message.text.trim();
    if (newName.length < 2) return ctx.reply("❌ Name too short!", Markup.forceReply());
    
    const oldName = ctx.session.editMember;
    db.prepare("UPDATE members SET name = ? WHERE name = ?").run(newName, oldName);
    db.prepare("UPDATE schedule SET member = ? WHERE member = ?").run(newName, oldName);
    
    ctx.replyWithMarkdown(`✅ *Member name updated!*\n\n*Old:* ${oldName}\n*New:* ${newName}\n\nSchedule assignments have been updated.`, getMemberManagementKeyboard());
    delete ctx.session.step;
    delete ctx.session.editMember;
  }
  else if (ctx.session.step === "add_phone" && ctx.from.id === ADMIN_ID) {
    const phone = ctx.message.text.trim();
    const memberName = ctx.session.phoneMember;
    
    // Simple phone validation
    if (phone.length < 9) {
      return ctx.reply("❌ Please enter a valid phone number!", Markup.forceReply());
    }
    
    db.prepare("UPDATE members SET phone = ? WHERE name = ?").run(phone, memberName);
    
    ctx.replyWithMarkdown(`✅ *Phone number added for ${memberName}!*\n\n📞 Phone: ${phone}`, getMemberManagementKeyboard());
    delete ctx.session.step;
    delete ctx.session.phoneMember;
  }
});

// ========== INLINE CALLBACKS ==========

// Talent selection
bot.action(/talent_(.*)/, ctx => {
  if (ctx.session?.step !== "talents") return;
  
  const role = ctx.match[1];
  
  if (role === "done") {
    if (ctx.session.talents.length === 0) {
      return ctx.answerCbQuery("❌ Please select at least one talent!");
    }
    
    db.prepare("INSERT OR REPLACE INTO members (user_id, name, talents, active) VALUES (?, ?, ?, 1)")
      .run(ctx.from.id, ctx.session.name, JSON.stringify(ctx.session.talents));
    
    ctx.deleteMessage().catch(() => {});
    ctx.replyWithMarkdown(`
🎉 *REGISTRATION COMPLETE!*

👤 *Name:* ${ctx.session.name}
🎭 *Talents:* ${ctx.session.talents.map(t => roleEmojis[t] + " " + t).join("  ")}

✨ *Welcome to PCM Fellowship!*
⏰ You will receive Wednesday morning reminders
🙏 To God be the glory!`, getMainMenu(ctx));
    
    delete ctx.session.step;
    return;
  }
  
  const index = ctx.session.talents.indexOf(role);
  if (index === -1) ctx.session.talents.push(role);
  else ctx.session.talents.splice(index, 1);
  
  ctx.editMessageReplyMarkup(getTalentKeyboard(ctx.session.talents).reply_markup);
  ctx.answerCbQuery();
});

// DELETE MEMBER
bot.action(/delete_(.+)/, ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const memberName = ctx.match[1];
  const member = db.prepare("SELECT * FROM members WHERE name = ?").get(memberName);
  
  if (!member) return ctx.answerCbQuery("Member not found");
  
  // Count schedule assignments
  const assignments = db.prepare("SELECT COUNT(*) as count FROM schedule WHERE member = ?").get(memberName).count;
  
  // Confirm deletion
  const keyboard = [
    [Markup.button.callback("✅ YES, Delete", `confirm_delete_${memberName}`)],
    [Markup.button.callback("❌ NO, Cancel", "manage_back")]
  ];
  
  ctx.editMessageText(
    `⚠️ *CONFIRM MEMBER DELETION*\n\n` +
    `👤 *Member:* ${memberName}\n` +
    `🎭 *Talents:* ${JSON.parse(member.talents || "[]").map(t => roleEmojis[t] + " " + t).join(", ")}\n` +
    `📅 *Active assignments:* ${assignments}\n` +
    `📞 *Phone:* ${member.phone || "Not set"}\n\n` +
    `⚠️ *This will:*\n` +
    `• Remove member from database\n` +
    `• Remove from future schedules\n` +
    `• Keep in existing schedules as "${memberName}"\n\n` +
    `*Are you sure you want to delete this member?*`,
    { 
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup 
    }
  );
});

bot.action(/confirm_delete_(.+)/, ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const memberName = ctx.match[1];
  
  // Delete member
  db.prepare("DELETE FROM members WHERE name = ?").run(memberName);
  
  ctx.editMessageText(`✅ *Member deleted successfully!*\n\n👤 *Deleted:* ${memberName}\n\nMember has been removed from the database.`, 
    { parse_mode: "Markdown" });
  ctx.answerCbQuery();
});

// EDIT MEMBER - SELECT ACTION
bot.action(/edit_select_(.+)/, ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const memberName = ctx.match[1];
  const member = db.prepare("SELECT * FROM members WHERE name = ?").get(memberName);
  
  if (!member) return ctx.answerCbQuery("Member not found");
  
  const keyboard = [
    [Markup.button.callback("✏️ Change Name", `edit_name_${memberName}`)],
    [Markup.button.callback("🎭 Change Talents", `edit_talents_${memberName}`)],
    [Markup.button.callback("🔙 Back", "manage_back")]
  ];
  
  const talents = JSON.parse(member.talents || "[]").map(t => roleEmojis[t] + " " + t).join(", ");
  
  ctx.editMessageText(
    `✏️ *EDIT MEMBER: ${memberName}*\n\n` +
    `📋 *Current Details:*\n` +
    `• Name: ${memberName}\n` +
    `• Talents: ${talents || "None"}\n` +
    `• Status: ${member.active ? "✅ Active" : "❌ Inactive"}\n` +
    `• Phone: ${member.phone || "Not set"}\n\n` +
    `👇 *Select what to edit:*`,
    { 
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup 
    }
  );
});

// EDIT MEMBER NAME
bot.action(/edit_name_(.+)/, ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const memberName = ctx.match[1];
  ctx.session = { step: "edit_name", editMember: memberName };
  
  ctx.editMessageText(`✏️ *CHANGE NAME FOR: ${memberName}*\n\nPlease enter the new name:`, 
    { parse_mode: "Markdown" });
  ctx.answerCbQuery();
});

// EDIT MEMBER TALENTS
bot.action(/edit_talents_(.+)/, ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const memberName = ctx.match[1];
  const member = db.prepare("SELECT talents FROM members WHERE name = ?").get(memberName);
  
  if (!member) return ctx.answerCbQuery("Member not found");
  
  const currentTalents = JSON.parse(member.talents || "[]");
  ctx.session = { step: "edit_talents", editMember: memberName, talents: currentTalents };
  
  ctx.editMessageText(
    `🎭 *EDIT TALENTS FOR: ${memberName}*\n\n` +
    `Current talents: ${currentTalents.map(t => roleEmojis[t] + " " + t).join(", ") || "None"}\n\n` +
    `Select new talents:`,
    { 
      parse_mode: "Markdown",
      reply_markup: getTalentKeyboard(currentTalents).reply_markup 
    }
  );
  ctx.answerCbQuery();
});

// ADD/UPDATE PHONE
bot.action(/phone_(.+)/, ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const memberName = ctx.match[1];
  ctx.session = { step: "add_phone", phoneMember: memberName };
  
  ctx.editMessageText(`📞 *ADD PHONE FOR: ${memberName}*\n\nPlease enter the phone number:`, 
    { parse_mode: "Markdown" });
  ctx.answerCbQuery();
});

// TOGGLE ACTIVE STATUS
bot.action(/toggle_(.+)/, ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const memberName = ctx.match[1];
  const current = db.prepare("SELECT active FROM members WHERE name = ?").get(memberName);
  
  if (!current) return ctx.answerCbQuery("Member not found");
  
  const newStatus = current.active ? 0 : 1;
  db.prepare("UPDATE members SET active = ? WHERE name = ?").run(newStatus, memberName);
  
  ctx.answerCbQuery(`${memberName} is now ${newStatus ? "✅ Active" : "❌ Inactive"}`);
  
  // Refresh the list
  const members = db.prepare("SELECT name, active FROM members ORDER BY name").all();
  
  const keyboard = [];
  members.forEach(m => {
    const status = m.active ? "✅" : "❌";
    keyboard.push([Markup.button.callback(`${status} ${m.name}`, `toggle_${m.name}`)]);
  });
  keyboard.push([Markup.button.callback("🔙 Cancel", "manage_back")]);
  
  ctx.editMessageReplyMarkup(Markup.inlineKeyboard(keyboard).reply_markup);
});

// MEMBER DETAILS
bot.action(/details_(.+)/, ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const memberName = ctx.match[1];
  const member = db.prepare("SELECT * FROM members WHERE name = ?").get(memberName);
  
  if (!member) return ctx.answerCbQuery("Member not found");
  
  const assignments = db.prepare("SELECT week, day, role, date FROM schedule WHERE member = ? ORDER BY date").all(memberName);
  const talents = JSON.parse(member.talents || "[]").map(t => roleEmojis[t] + " " + t).join(", ");
  
  let msg = `📋 *MEMBER DETAILS: ${memberName}*\n\n`;
  msg += `👤 *Basic Info:*\n`;
  msg += `• Name: ${memberName}\n`;
  msg += `• Status: ${member.active ? "✅ Active" : "❌ Inactive"}\n`;
  msg += `• Phone: ${member.phone || "Not set"}\n`;
  msg += `• Registered: ${member.registered}\n`;
  msg += `• Telegram ID: ${member.user_id}\n\n`;
  
  msg += `🎭 *Talents:*\n${talents || "No talents selected"}\n\n`;
  
  if (assignments.length > 0) {
    msg += `📅 *Current Assignments (${assignments.length}):*\n`;
    assignments.forEach(a => {
      const date = formatDate(a.date);
      msg += `• ${a.week} - ${dayEmojis[a.day]} ${date} - ${roleEmojis[a.role]} ${a.role}\n`;
    });
  } else {
    msg += `📅 *Current Assignments:* None\n`;
  }
  
  const keyboard = [
    [Markup.button.callback("✏️ Edit Member", `edit_select_${memberName}`)],
    [Markup.button.callback("✅❌ Toggle Active", `toggle_${memberName}`)],
    [Markup.button.callback("🔙 Back", "manage_back")]
  ];
  
  ctx.editMessageText(msg, { 
    parse_mode: "Markdown",
    reply_markup: Markup.inlineKeyboard(keyboard).reply_markup 
  });
  ctx.answerCbQuery();
});

// EDIT TALENTS COMPLETION
bot.action(/edit_talent_(.*)/, ctx => {
  if (!ctx.session?.step === "edit_talents") return;
  
  const role = ctx.match[1];
  
  if (role === "done") {
    if (ctx.session.talents.length === 0) {
      return ctx.answerCbQuery("❌ Member must have at least one talent!");
    }
    
    const memberName = ctx.session.editMember;
    db.prepare("UPDATE members SET talents = ? WHERE name = ?").run(JSON.stringify(ctx.session.talents), memberName);
    
    ctx.deleteMessage().catch(() => {});
    ctx.replyWithMarkdown(`✅ *Talents updated for ${memberName}!*\n\n🎭 New talents: ${ctx.session.talents.map(t => roleEmojis[t] + " " + t).join("  ")}`, getMemberManagementKeyboard());
    
    delete ctx.session.step;
    delete ctx.session.editMember;
    delete ctx.session.talents;
    return;
  }
  
  const index = ctx.session.talents.indexOf(role);
  if (index === -1) ctx.session.talents.push(role);
  else ctx.session.talents.splice(index, 1);
  
  ctx.editMessageReplyMarkup(getTalentKeyboard(ctx.session.talents).reply_markup);
  ctx.answerCbQuery();
});

// SETTINGS CALLBACKS
bot.action("clear_db", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const keyboard = [
    [Markup.button.callback("🗑️ Clear ALL Data", "clear_all_data")],
    [Markup.button.callback("📅 Clear Schedule Only", "clear_schedule_only")],
    [Markup.button.callback("🔙 Back", "settings_back")]
  ];
  
  ctx.editMessageText(
    `⚠️ *DATABASE CLEARING OPTIONS*\n\n` +
    `🗑️ *Clear ALL Data* - Delete everything (members + schedule)\n` +
    `📅 *Clear Schedule Only* - Keep members, remove schedule\n` +
    `🔙 *Back* - Return to settings\n\n` +
    `⚠️ *Warning: This action cannot be undone!*`,
    { 
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup 
    }
  );
});

bot.action("clear_all_data", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  db.prepare("DELETE FROM members").run();
  db.prepare("DELETE FROM schedule").run();
  
  ctx.editMessageText(`✅ *ALL DATA CLEARED!*\n\nDatabase has been completely reset.`, 
    { parse_mode: "Markdown" });
  ctx.answerCbQuery();
});

bot.action("clear_schedule_only", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  db.prepare("DELETE FROM schedule").run();
  
  ctx.editMessageText(`✅ *SCHEDULE CLEARED!*\n\nAll schedule data removed. Members data preserved.`, 
    { parse_mode: "Markdown" });
  ctx.answerCbQuery();
});

bot.action("export_data", ctx => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("👑 Admin only");
  
  const members = db.prepare("SELECT * FROM members ORDER BY name").all();
  const schedule = db.prepare("SELECT * FROM schedule ORDER BY date").all();
  
  const data = {
    exported: new Date().toISOString(),
    members: members,
    schedule: schedule,
    stats: {
      totalMembers: members.length,
      activeMembers: members.filter(m => m.active).length,
      totalAssignments: schedule.length
    }
  };
  
  const exportPath = path.join(dataPath, `export_${Date.now()}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
  
  ctx.replyWithDocument({
    source: exportPath,
    filename: `pcm_fellowship_export_${new Date().toISOString().split('T')[0]}.json`
  }).then(() => {
    fs.unlinkSync(exportPath);
  });
  
  ctx.answerCbQuery("Exporting data...");
});

bot.action("settings_back", ctx => {
  ctx.editMessageText("🔙 *Returning to admin panel...*", 
    { parse_mode: "Markdown" });
  setTimeout(() => {
    ctx.replyWithMarkdown("👑 *Admin Control Panel*", getAdminPanelKeyboard());
  }, 500);
});

bot.action("manage_back", ctx => {
  ctx.deleteMessage();
  ctx.replyWithMarkdown("🔙 *Returning to member management...*", getMemberManagementKeyboard());
});

// ========== ERROR HANDLING ==========
bot.catch((err, ctx) => {
  console.error("❌ Bot error:", err);
  ctx.reply("❌ Something went wrong. Please try again.");
});

// ========== LAUNCH ==========
bot.launch().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("✨ PCM FELLOWSHIP BOT WITH MEMBER MANAGEMENT IS LIVE! ✨");
  console.log("=".repeat(60));
  console.log("👑 NEW MEMBER MANAGEMENT FEATURES:");
  console.log("  • ❌ Delete unwanted members");
  console.log("  • ✏️ Edit member names and talents");
  console.log("  • 📞 Add/update phone numbers");
  console.log("  • ✅❌ Toggle active/inactive status");
  console.log("  • 📋 View detailed member info");
  console.log("  • 🗑️ Clear database with options");
  console.log("  • 📤 Export data as JSON");
  console.log("\n🙏 To God be all the glory!");
  console.log("=".repeat(60) + "\n");
});

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());