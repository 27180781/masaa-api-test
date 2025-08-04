const COLORS = {
    title: '#FFFFFF',
    text: '#FFFFFF',
    elements: {
        fire: 'rgba(231, 76, 60, 0.9)',
        water: 'rgba(52, 152, 219, 0.9)',
        air: 'rgba(241, 196, 15, 0.9)',
        earth: 'rgba(46, 204, 113, 0.9)',
        default: 'rgba(204, 204, 204, 0.9)'
    },
    statusOk: '#2ecc71',
    statusError: '#e74c3c'
};

const FONTS = {
    mainTitle: 'FbKanuba Bold 60',
    subtitle: 'FbKanuba 50',
    label: 'FbKanuba Bold 40',
    percentage: 'FbKanuba Bold 32',
    statusText: 'FbKanuba Bold 72',
    warningText: 'FbKanuba 36',
    groupTitle: 'FbKanuba Bold 48',
    noDataMessage: 'FbKanuba Bold 60',
    participantName: 'FbKanuba Bold 32',
    legendText: 'FbKanuba 36'
};

const LAYOUT = {
    summaryChart: {
        width: 1920,
        height: 1080,
        backgroundImagePath: './assets/background.png',
        barWidth: 220,
        barMargin: 80,
        chartHeight: 600
    },
    licenseStatus: {
        width: 1920,
        height: 1080,
        backgroundImagePath: './assets/background.png'
    },
    groupBreakdown: {
        width: 1920,
        height: 1080,
        backgroundImagePath: './assets/background.png',
        pieRadius: 150,
        padding: 80
    },
    participantList: {
        width: 1920,
        height: 1080,
        backgroundImagePath: './assets/background.png',
        padding: 60,
        barWidth: 300,
        barHeight: 30,
        rowGap: 15
    }
};

module.exports = {
    COLORS,
    FONTS,
    LAYOUT
};