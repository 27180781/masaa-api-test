# התחל מתמונת בסיס רשמית של Node.js
FROM node:20

# התקן את ספריות המערכת הנדרשות עבור Sharp
RUN apt-get update && apt-get install -y \
    build-essential \
    librsvg2-dev

# קבע את ספריית העבודה
WORKDIR /app

# העתק והתקן תלויות
COPY package*.json ./
RUN npm install --production

# העתק את שאר קבצי האפליקציה
COPY . .

# חשוף את הפורט
EXPOSE 3000

# הגדר את הפקודה להרצת האפליקציה
CMD [ "node", "index.js" ]