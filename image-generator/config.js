// ... הגדרות COLORS ו-FONTS נשארות כפי שהן
const COLORS = {
    title: '#FFFFFF', // לדוגמה, נשנה לצבע לבן שיראה טוב על רקע כהה
    text: '#FFFFFF',  // גם כן לבן
    elements: { // צבעי העמודות בגרף
        fire: 'rgba(231, 76, 60, 0.85)',   // ניתן להוסיף שקיפות קלה
        water: 'rgba(52, 152, 219, 0.85)',
        air: 'rgba(241, 196, 15, 0.85)',
        earth: 'rgba(46, 204, 113, 0.85)',
        default: 'rgba(204, 204, 204, 0.85)'
    }
};

// החלף את אובייקט ה-FONTS הקיים באובייקט הבא:
const FONTS = {
    // הפורמט החדש: "שם הפונט, משקל, גודל"
    title: 'FbKanuba Bold 48',
    label: 'FbKanuba 32',
    percentage: 'FbKanuba Bold 28'
};

const LAYOUT = {
    summaryChart: {
        width: 1920, // 🖼️ מידה חדשה
        height: 1080, // 🖼️ מידה חדשה
        backgroundImagePath: './assets/background.png', // 🖼️ נתיב לתמונת הרקע
        barWidth: 150,
        barMargin: 70,
        chartHeight: 500
    }
};

module.exports = {
    COLORS,
    FONTS,
    LAYOUT
};