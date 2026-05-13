# Use an official lightweight Node.js image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of your application code into the container
COPY . .

# Expose the port your app runs on 
# (Change 3000 to whatever port your server.js is listening on)
EXPOSE 5000

# Command to start the application
CMD ["node", "server.js"]