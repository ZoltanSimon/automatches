import { addLeagues } from "../common-functions.js";

addLeagues("pleague");
document.getElementById("match-list").style.visibility = "visible";

document.querySelectorAll('.table-container').forEach(container => {
  // Check if content actually overflows
  const needsExpansion = container.scrollHeight > container.clientHeight;
  
  if (needsExpansion) {
    // Add class to show fade
    container.classList.add('has-overflow');
    
    // Create and add button INSIDE container
    const btn = document.createElement('button');
    btn.className = 'show-more-btn';
    btn.textContent = 'Show More';
    container.appendChild(btn);
    
    // Add click handler
    btn.addEventListener('click', () => {
      container.classList.toggle('expanded');
      btn.textContent = container.classList.contains('expanded') ? 'Show Less' : 'Show More';
    });
  }
});