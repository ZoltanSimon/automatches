import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogo,
} from "../instapics.js";
export function drawUCLMatches() {
  // Define the center and radius of the circle
  const centerX = 1080 / 2;
  const centerY = 1080 / 2;
  const radius = 460; // Adjust radius as needed

  const teams = [
    40, 541, 530, 529, 496, 499, 157, 165, 168, 541, 530, 529, 40, 541, 530,
    529, 40, 541, 530, 529, 40, 541, 530, 529, 40, 541, 530, 529, 40, 541, 530,
    529, 40, 541, 530, 529,
  ];
  // Number of items
  const itemCount = 36;
  loadClubLogo(40);

  // Calculate the angle between each item (in radians)
  const angleIncrement = (2 * Math.PI) / itemCount;

  // Loop through each item
  for (let i = 0; i < teams.length; i++) {
    // Calculate the angle for the current item
    const angle = i * angleIncrement;

    // Calculate the x and y position using the angle
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    // Draw the item (e.g., a small circle)
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI); // Radius of 5 for the item circle
    ctx.fillStyle = "blue"; // Set item color
    ctx.fill();
    console.log(teams[i]);
    ctx.drawImage(imgs.clubs[teams[i]], x - 20, y - 20, 40, 40);
  }
}
