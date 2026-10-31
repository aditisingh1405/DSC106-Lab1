import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = (await fetchJSON('../lib/projects.json')) ?? [];

const projectsContainer = document.querySelector('.projects');

// Lab 4, Step 1.6: show the project count in the page title
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
  projectsTitle.textContent = `${projects.length} Projects`;
}

// Lab 5: pie chart of projects per year, plus search and click-to-filter
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

// Color by year (not by index) so each year keeps its color while filtering
const allYears = [...new Set(projects.map((p) => p.year))].sort();
const colors = d3.scaleOrdinal(d3.schemeTableau10).domain(allYears);

// The two filters. Both live here, so they always combine.
let query = '';
let selectedYear = null; // the selected wedge's year label; null = nothing selected

// Step 5.4 fix: in the original lab code, the search listener filtered `projects`
// by the query only and the click handler filtered `projects` by year only, so
// whichever ran last threw away the other filter. Here both handlers update
// their own variable and then filter through this one shared function.
function filterByQuery(projectsGiven) {
  return projectsGiven.filter((project) => {
    // Search all visible metadata; skip the image URL, which is identical for
    // every project and contains words like "labs" that would match everything
    let { image, ...searchable } = project;
    let values = Object.values(searchable).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });
}

function getVisibleProjects() {
  let visible = filterByQuery(projects);
  if (selectedYear !== null) {
    visible = visible.filter((project) => project.year === selectedYear);
  }
  return visible;
}

function renderPieChart(projectsGiven) {
  // Step 3.1: count projects per year
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  let data = rolledData
    .map(([year, count]) => ({ value: count, label: year }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // If a search hides the selected year entirely, drop the selection
  if (selectedYear !== null && !data.some((d) => d.label === selectedYear)) {
    selectedYear = null;
  }

  let sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  let arcData = sliceGenerator(data);
  let arcs = arcData.map((d) => arcGenerator(d));

  // Step 4.4: clear old wedges and legend items before redrawing
  svg.selectAll('path').remove();
  legend.selectAll('li').remove();

  arcs.forEach((arc, i) => {
    let d = data[i];
    let path = svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(d.label))
      .attr('class', d.label === selectedYear ? 'selected' : null)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', `${d.label}: ${d.value} projects`)
      .attr('aria-pressed', d.label === selectedYear)
      .on('click', () => selectYear(d.label))
      .on('keydown', (event) => onKey(event, d.label));
    path.append('title').text(`${d.label}: ${d.value} projects`);
  });

  data.forEach((d) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(d.label)}`)
      .attr('class', d.label === selectedYear ? 'legend-item selected' : 'legend-item')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-pressed', d.label === selectedYear)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => selectYear(d.label))
      .on('keydown', (event) => onKey(event, d.label));
  });
}

// Step 5.2: clicking a wedge (or legend item) selects it; clicking again deselects
function selectYear(year) {
  selectedYear = selectedYear === year ? null : year;
  update();
}

function onKey(event, year) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectYear(year);
  }
}

// One place that redraws everything from the current query + selection.
// The pie shows every year matching the search; the list also applies the year.
function update() {
  renderPieChart(filterByQuery(projects));
  renderProjects(getVisibleProjects(), projectsContainer, 'h2');
}

// Step 4: search bar (`input` updates as you type)
const searchInput = document.querySelector('.searchBar');
searchInput?.addEventListener('input', (event) => {
  query = event.target.value;
  update();
});

// Initial render on page load
update();
