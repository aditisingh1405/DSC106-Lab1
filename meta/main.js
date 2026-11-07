import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Step 5.4: module scope, so isCommitSelected can use the scales renderScatterPlot creates
let xScale;
let yScale;

// Step 1.1: read the CSV, converting the columns that aren't really strings
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

// Step 1.2: one object per commit, derived from its lines
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: 'https://github.com/aditisingh1405/DSC106-Lab1/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // Non-enumerable, so it stays out of the way when logging a commit
      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    });
}

// Step 1.3: summary stats
function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );

  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { dayPeriod: 'short' }),
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  dl.append('dt').text('Files');
  dl.append('dd').text(fileLengths.length);

  dl.append('dt').text('Longest file (lines)');
  dl.append('dd').text(d3.max(fileLengths, (d) => d[1]));

  dl.append('dt').text('Avg line length');
  dl.append('dd').text(Math.round(d3.mean(data, (d) => d.length)));

  dl.append('dt').text('Max depth');
  dl.append('dd').text(d3.max(data, (d) => d.depth));

  dl.append('dt').text('Most work done');
  dl.append('dd').text(maxPeriod);
}

// Step 2: scatterplot of commits by date and time of day
function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Step 4.2: sqrt scale, so dot *area* is what tracks lines edited
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 30]);

  // Step 2.3: gridlines go first, so they sit behind everything else
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Step 2.2: axes
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale));

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'),
    );

  // Step 4.3: big dots first, so small ones land on top and stay hoverable
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  svg
    .append('g')
    .attr('class', 'dots')
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  createBrushSelector(svg);
}

// Step 3: tooltip
function renderTooltipContent(commit) {
  if (Object.keys(commit).length === 0) return;

  const link = document.getElementById('commit-link');
  link.href = commit.url;
  link.textContent = commit.id;

  document.getElementById('commit-date').textContent =
    commit.datetime?.toLocaleString('en', { dateStyle: 'full' });
  document.getElementById('commit-time').textContent =
    commit.datetime?.toLocaleString('en', { timeStyle: 'short' });
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  const { width, height } = tooltip.getBoundingClientRect();
  const offset = 12;

  // Beside the cursor, flipping to the other side instead of running off screen.
  // The newest commits are on the chart's right edge, so this does come up.
  const fitsRight = event.clientX + offset + width <= window.innerWidth;
  const fitsBelow = event.clientY + offset + height <= window.innerHeight;
  const left = fitsRight ? event.clientX + offset : event.clientX - offset - width;
  const top = fitsBelow ? event.clientY + offset : event.clientY - offset - height;

  tooltip.style.left = `${Math.max(0, left)}px`;
  tooltip.style.top = `${Math.max(0, top)}px`;
}

// Step 5: brushing
function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));

  // The brush overlay catches all mouse events, so put the dots back above it
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const count = selectedCommits.length;

  document.querySelector('#selection-count').textContent =
    `${count || 'No'} commit${count === 1 ? '' : 's'} selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  container.innerHTML = '';

  if (selectedCommits.length === 0) {
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);

  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  for (const [language, count] of breakdown) {
    const formatted = d3.format('.1~%')(count / lines.length);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
