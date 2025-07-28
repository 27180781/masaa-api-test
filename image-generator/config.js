const COLORS = {
    title: '#FFFFFF',
    text: '#FFFFFF',
    elements: {
        fire: 'rgba(231, 76, 60, 0.9)',
        water: 'rgba(52, 152, 219, 0.9)',
        air: 'rgba(241, 196, 15, 0.9)',
        earth: 'rgba(46, 204, 113, 0.9)',
        default: 'rgba(204, 204, 204, 0.9)'
    }, // ⬅️ הוספת פסיק
    statusOk: '#2ecc71',      // ירוק
    statusError: '#e74c3c'  // אדום
};

const FONTS = {
    mainTitle: 'FbKanuba Bold 60',  // כותרת ראשית
    subtitle: 'FbKanuba 60',       // כותרת משנה
    label: 'FbKanuba Bold 40',        // הגדלת הפונט של שמות היסודות
    percentage: 'FbKanuba Bold 32', // ⬅️ הוספת פסיק
    statusText: 'FbKanuba Bold 72',
    warningText: 'FbKanuba 60'
    groupTitle: 'FbKanuba Bold 48',
    noDataMessage: 'FbKanuba Bold 60'
}
const LAYOUT = {
    summaryChart: {
        width: 1920,
        height: 1080,
        backgroundImagePath: './assets/background.png',
        barWidth: 220,      // הרחבת העמודות
        barMargin: 80,
        chartHeight: 600    // הגבהת העמודות
    }, // ⬅️ הוספת פסיק
    licenseStatus: {
        width: 1920,
        height: 1080, // גודל סטנדרטי לשיתוף ברשתות חברתיות
        backgroundImagePath: './assets/background.png'
      groupBreakdown: {
        width: 1920,
        height: 1080,
        backgroundImagePath: './assets/background.png',
        pieRadius: 150, // רדיוס לכל גרף עוגה
        padding: 80 // ריווח פנימי
    }
};

module.exports = {
    COLORS,
    FONTS,
    LAYOUT
};