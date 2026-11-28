// Octave and scale information
const radius = 150; // Radius of the outer octave circle
const textRadius = 180; // Radius of the path for the arced labels
const centerX = 200; // X center of the circle
const centerY = 200; // Y center of the circle
const offsetDistance = 30; // Distance to offset the pitch circles

const intervals = [
  { label: "α", intervalCents: 0 },
  { label: "γ", intervalCents: 204 },
  { label: "ε", intervalCents: 204 },
  { label: "β", intervalCents: 294 },
  { label: "δ", intervalCents: 204 } 
];

const totalCents = 1200; // Total cents in an octave

const svg = document.getElementById("octave-circle");

let currentAngle = -90; // Starting from top (12 o'clock)

intervals.forEach((pitch, index) => {
  // Calculate the angle for this pitch
  const arcFraction = pitch.intervalCents / totalCents;
  currentAngle += arcFraction * 360;

  // Calculate the position of the small circle
  const radians = (currentAngle * Math.PI) / 180;
  const x = centerX + radius * Math.cos(radians);
  const y = centerY + radius * Math.sin(radians);

  // Create the small circle for the pitch
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  circle.setAttribute("cx", x);
  circle.setAttribute("cy", y);
  circle.setAttribute("r", 20);
  circle.setAttribute("class", "pitch-circle");
  svg.appendChild(circle);

  // Add label inside the small circle
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", x);
  label.setAttribute("y", y);
  label.setAttribute("class", "label");
  label.textContent = pitch.label;
  svg.appendChild(label);

  // Draw arc label between this pitch and the previous one
  if (index > 0) {
    const prevAngle = currentAngle - arcFraction * 360;
    const midAngle = (prevAngle + currentAngle) / 2;

    // Use the mid-angle to calculate where the text should be centered on the larger circle
    const arcPosition = ((midAngle + 90) / 360) * 100; // Convert angle to percentage offset

    // Create the text element for the arc label
    const arcLabel = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    arcLabel.setAttribute("class", "arc-label");

    // Attach the text to the path and set the starting offset
    const textPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "textPath"
    );
    textPath.setAttribute("href", "#text-path");
    textPath.setAttribute("startOffset", `${arcPosition}%`);
    textPath.textContent = `+${pitch.intervalCents} cents →`;

    arcLabel.appendChild(textPath);
    svg.appendChild(arcLabel);
  }
});

// Handle the final interval back to the first pitch
const finalAngle = 270; // The first pitch starts at -90 degrees
const midFinalAngle = (currentAngle + finalAngle) / 2;

const finalArcPosition = ((midFinalAngle + 90) / 360) * 100; // Convert to percentage offset

const finalArcLabel = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "text"
);
finalArcLabel.setAttribute("class", "arc-label");

const finalTextPath = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "textPath"
);
finalTextPath.setAttribute("href", "#text-path");
finalTextPath.setAttribute("startOffset", `${finalArcPosition}%`);
finalTextPath.textContent = `+294 cents →`; // The last interval (back to "1") is 90 cents

finalArcLabel.appendChild(finalTextPath);
svg.appendChild(finalArcLabel);
