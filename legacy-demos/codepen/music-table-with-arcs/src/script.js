// Helper function to get the center coordinates of an HTML element
function getElementCenter(elem) {
  const rect = elem.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX + rect.width / 2,
    y: rect.top + window.scrollY + rect.height / 2
  };
}

function getElementTopCenter(elem) {
  const rect = elem.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX + rect.width / 2,
    y: rect.top + window.scrollY
  };
}

function getElementTopLeftOfCenter(elem) {
  const rect = elem.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX + rect.width / 4,
    y: rect.top + window.scrollY
  };
}

// Connect elements with arcs
function drawArcBetweenElements(
  elem1,
  elem2,
  arcId,
  labelId,
  labelBackgroundId,
  cents,
  fixedHeightOffset = 70
) {
  const center1 = getElementTopCenter(elem1);
  const center2 = getElementTopLeftOfCenter(elem2);
  const dx = center2.x - center1.x;
  const dy = center2.y - center1.y;
  const midX = (center1.x + center2.x) / 2;
  const fixedY = Math.min(center1.y, center2.y) - fixedHeightOffset;

  // Calculate the SVG path for an arc
  const path = `M ${center1.x},${center1.y} Q ${midX},${fixedY} ${center2.x},${center2.y}`;
  document.getElementById(arcId).setAttribute("d", path);

  // Position the label at the midpoint of the arc
  // const midX = (center1.x + center2.x) / 2;
  const midY = (center1.y + center2.y) / 2;
  const labelElem = document.getElementById(labelId);
  labelElem.setAttribute("x", midX - 25);
  labelElem.setAttribute("y", fixedY + 20);
  labelElem.textContent = `+${cents}¢`;

  const labelBackgrounElem = document.getElementById(labelBackgroundId);
  labelBackgrounElem.setAttribute("x", midX - 30);
  labelBackgrounElem.setAttribute("y", fixedY + 4);
}

// Draw arcs between table items
const alpha1 = document.getElementById("alpha1");
const gamma1 = document.getElementById("gamma1");
const epsilon1 = document.getElementById("epsilon1");
const eta1 = document.getElementById("eta1");
const beta1 = document.getElementById("beta1");
const delta1 = document.getElementById("delta1");
const zeta1 = document.getElementById("zeta1");
const alpha2 = document.getElementById("alpha2");
const gamma2 = document.getElementById("gamma2");
const epsilon2 = document.getElementById("epsilon2");
const eta2 = document.getElementById("eta2");

drawArcBetweenElements(alpha1, beta1, "arc1", "label1", "rect1", 702);
drawArcBetweenElements(gamma1, delta1, "arc2", "label2", "rect2", 702);
drawArcBetweenElements(epsilon1, zeta1, "arc3", "label3", "rect3", 702);
drawArcBetweenElements(eta1, alpha2, "arc4", "label4", "rect4", 584);
drawArcBetweenElements(beta1, gamma2, "arc5", "label5", "rect5", 702);
drawArcBetweenElements(delta1, epsilon2, "arc6", "label6", "rect6", 702);
drawArcBetweenElements(zeta1, eta2, "arc7", "label7", "rect7", 702);
