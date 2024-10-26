# Use the official Node.js image
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json if you have them
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your app's code
COPY . .

# Expose the app's port (change to your app's port if needed)
EXPOSE 3000

# Command to run your app
CMD [ "npm", "start" ]
