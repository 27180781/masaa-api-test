const { createCanvas, loadImage } = require('canvas'); // אין צורך ב-pango ישירות
const { COLORS, FONTS, LAYOUT } = require('./config.js');

/**
 * פונקציית עזר לציור טקסט מימין לשמאל באמצעות Pango
 * @param {CanvasRenderingContext2D} context - קונטקסט הציור של הקנבס
 * @param {string} text - הטקסט לציור
 * @param {number} x - קואורדינטת X של מרכז הטקסט
 * @param {number} y - קואורדינטת Y של בסיס הטקסט
 * @param {string} fontDescription - תיאור הפונט בפורמט של Pango
 * @param {string} color - צבע הטקסט
 */
function drawRtlText(context, text, x, y, fontDescription, color) {
  const layout = context.createPangoLayout(text);
  layout.setFontDescription(fontDescription);
  
  // מרכוז הטקסט אופקית
  const textWidth = layout.getPixelExtents().ink.width;
  const centeredX = x - (textWidth / 2);

  context.fillStyle = color;
  context.moveTo(centeredX, y);
  context.showPangoLayout(layout);
}


async function createGameSummaryImage(gameId, profile) {
    const { width, height, backgroundImagePath, barWidth, barMargin, chartHeight } = LAYOUT.summaryChart;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    // 1. טעינה וציור של תמונת הרקע
    const background = await loadImage(backgroundImagePath);
    context.drawImage(background, 0, 0, width, height);

    // 2. כותרת - שימוש בפונקציית העזר החדשה
    drawRtlText(
      context,
      `סיכום תוצאות למשחק: ${gameId}`,
      width / 2,
      50, // התאמת מיקום ה-Y לפי הצורך
      FONTS.title,
      COLORS.title
    );
    
    // 3. ציור הגרף
    const elements = Object.keys(profile);
    const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;

    elements.forEach((element, index) => {
        const barHeight = (profile[element] / 100) * chartHeight;
        const x = startX + index * (barWidth + barMargin);
        const y = height - 150 - barHeight;
        
        context.fillStyle = COLORS.elements[element] || COLORS.elements.default;
        context.fillRect(x, y, barWidth, barHeight);

        // ציור האחוזים עם הפונקציה החדשה
        drawRtlText(
          context,
          `${profile[element].toFixed(1)}%`,
          x + barWidth / 2,
          y - 50, // התאמת מיקום
          FONTS.percentage,
          COLORS.text
        );
        
        // ציור שם היסוד עם הפונקציה החדשה
        const hebrewElement = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' }[element] || element;
        drawRtlText(
          context,
          hebrewElement,
          x + barWidth / 2,
          height - 120, // התאמת מיקום
          FONTS.label,
          COLORS.text
        );
    });

    return canvas;
}

module.exports = {
    createGameSummaryImage
};