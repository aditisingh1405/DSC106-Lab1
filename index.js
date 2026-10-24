import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// Step 2: latest 3 projects on the home page
const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects?.slice(0, 3) ?? [];

const projectsContainer = document.querySelector('.projects');
renderProjects(latestProjects, projectsContainer, 'h3');

// Step 3: live GitHub profile stats
const githubData = await fetchGitHubData('aditisingh1405');
const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
  profileStats.innerHTML = githubData
    ? `
        <h2>My GitHub Stats</h2>
        <dl>
          <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
          <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
          <dt>Followers</dt><dd>${githubData.followers}</dd>
          <dt>Following</dt><dd>${githubData.following}</dd>
        </dl>
      `
    : '<p>GitHub stats are unavailable right now.</p>';
}
