# התחל מתמונת בסיס רשמית של Node.js
FROM node:20

# התקן את ספריות המערכת הנדרשות
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fonts-noto-core

#⭐️ הגדר משתנה סביבה שיכריח את npm להדר את canvas מהמקור
ENV npm_config_build_from_source=true

# קבע את ספריית העבודה
WORKDIR /app

# העתק את קבצי התלויות והתקן אותן
COPY package*.json ./
RUN npm install --production

# העתק את שאר קבצי האפליקציה
COPY . .

# חשוף את הפורט שהאפליקציה מאזינה לו
EXPOSE 3000

# הגדר את הפקודה שתריץ את האפליקציה
CMD [ "node", "index.js" ]