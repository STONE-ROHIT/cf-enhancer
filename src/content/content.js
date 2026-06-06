import dashboardCSS from './dashboard.css?inline'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

function getHandleFromURL() {
  const match = window.location.pathname.match(/^\/profile\/(.+)/)
  if (match) return match[1]
  return null
}

function getRankColor(rank) {
  if (!rank) return '#808080'
  const map = {
    'newbie': '#808080',
    'pupil': '#008000',
    'specialist': '#03a89e',
    'expert': '#0070ff',
    'candidate master': '#aa00aa',
    'master': '#ff8c00',
    'international master': '#ff8c00',
    'grandmaster': '#ff3333',
    'international grandmaster': '#ff1111',
    'legendary grandmaster': '#ff0000'
  }
  return map[rank.toLowerCase()] || '#808080'
}

function scrapeSocialLinks() {
  const links = []
  const seen = new Set()
  const anchors = document.querySelectorAll('.info a[href], .userbox a[href]')
  for (const a of anchors) {
    const href = a.href
    if (!href || seen.has(href)) continue
    if (!href.startsWith('http')) continue
    if (href.includes('codeforces.com')) continue
    seen.add(href)
    let label = a.textContent.trim()
    if (!label) {
      try { label = new URL(href).hostname.replace('www.', '') }
      catch { label = href }
    }
    links.push({ href, label })
  }
  return links
}

function processSubmissions(submissions) {
  if (!submissions || !Array.isArray(submissions)) return {
    totalSolved: 0,
    groups: { '<1000': 0, '1000': 0, '1100': 0, '1200': 0, '1300': 0, '1400': 0, '1500': 0, '1600': 0, '1700': 0, '1800': 0, '1900': 0, '2000': 0, '2000+': 0 }
  }
  const solved = new Map()
  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const key = `${sub.problem.contestId}-${sub.problem.index}`
      if (!solved.has(key)) solved.set(key, sub.problem)
    }
  }
  const groups = { '<1000': 0, '1000': 0, '1100': 0, '1200': 0, '1300': 0, '1400': 0, '1500': 0, '1600': 0, '1700': 0, '1800': 0, '1900': 0, '2000': 0, '2000+': 0 }
  for (const problem of solved.values()) {
    const r = problem.rating
    if (!r) groups['Unrated']++
    else if (r < 1000) groups['<1000']++
    else if (r < 1100) groups['1000']++
    else if (r < 1200) groups['1100']++
    else if (r < 1300) groups['1200']++
    else if (r < 1400) groups['1300']++
    else if (r < 1500) groups['1400']++
    else if (r < 1600) groups['1500']++
    else if (r < 1700) groups['1600']++
    else if (r < 1800) groups['1700']++
    else if (r < 1900) groups['1800']++
    else if (r < 2000) groups['1900']++
    else if (r < 2100) groups['2000']++
    else groups['2000+']++
  }
  return { totalSolved: solved.size, groups }
}

function processWeaknesses(submissions) {
  if (!submissions || !Array.isArray(submissions)) return []
  const problemMap = new Map()
  for (const sub of submissions) {
    const key = `${sub.problem.contestId}-${sub.problem.index}`
    const tags = sub.problem.tags || []
    if (!problemMap.has(key)) problemMap.set(key, { tags, solved: false })
    if (sub.verdict === 'OK') problemMap.get(key).solved = true
  }
  const tagStats = new Map()
  for (const { tags, solved } of problemMap.values()) {
    for (const tag of tags) {
      if (!tagStats.has(tag)) tagStats.set(tag, { attempted: 0, solved: 0 })
      const stat = tagStats.get(tag)
      stat.attempted++
      if (solved) stat.solved++
    }
  }
  const results = []
  for (const [tag, { attempted, solved }] of tagStats.entries()) {
    if (attempted < 5) continue
    const solveRate = Math.round((solved / attempted) * 100)
    results.push({ tag, attempted, solved, solveRate })
  }
  results.sort((a, b) => a.solveRate - b.solveRate)
  return results.slice(0, 8)
}

function processActivity(submissions) {
  if (!submissions || !Array.isArray(submissions)) return new Map()
  const activityMap = new Map()
  for (const sub of submissions) {
    const date = new Date(sub.creationTimeSeconds * 1000)
    const key = date.toISOString().split('T')[0]
    activityMap.set(key, (activityMap.get(key) || 0) + 1)
  }
  return activityMap
}

function getHeatmapColor(count) {
  if (count === 0) return '#1a1a2e'
  if (count <= 2) return 'rgba(0, 212, 170, 0.3)'
  if (count <= 5) return 'rgba(0, 212, 170, 0.55)'
  if (count <= 9) return 'rgba(0, 212, 170, 0.75)'
  return 'rgba(0, 212, 170, 1.0)'
}

function buildHeatmapHTML(submissions) {
  const activityMap = processActivity(submissions)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 52 * 7 + 1)
  startDate.setDate(startDate.getDate() - startDate.getDay())
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  let totalInYear = 0
  let activeDays = 0
  for (const [dateStr, count] of activityMap.entries()) {
    const date = new Date(dateStr)
    if (date >= oneYearAgo) { totalInYear += count; activeDays++ }
  }
  const weeks = []
  const monthLabels = []
  const current = new Date(startDate)
  let lastMonth = -1
  for (let w = 0; w < 53; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split('T')[0]
      const count = activityMap.get(dateStr) || 0
      const isFuture = current > today
      if (current.getMonth() !== lastMonth && d === 0) {
        monthLabels.push({ week: w, label: current.toLocaleDateString('en', { month: 'short' }) })
        lastMonth = current.getMonth()
      }
      days.push({ dateStr, count, isFuture })
      current.setDate(current.getDate() + 1)
    }
    weeks.push(days)
  }
  const monthLabelHTML = monthLabels.map(({ week, label }) =>
    `<span class="cfe-month-label" style="left: ${week * 15}px">${label}</span>`
  ).join('')
  const gridHTML = weeks.map(days =>
    `<div class="cfe-heatmap-week">
      ${days.map(({ dateStr, count, isFuture }) =>
        `<div class="cfe-heatmap-cell"
          style="background: ${isFuture ? 'transparent' : getHeatmapColor(count)}"
          title="${isFuture ? '' : `${dateStr}: ${count} submission${count !== 1 ? 's' : ''}`}">
        </div>`
      ).join('')}
    </div>`
  ).join('')
  return `
    <div class="cfe-activity-stats">
      <div class="cfe-stat">
        <span class="cfe-stat-value" style="color: var(--accent)">${totalInYear}</span>
        <span class="cfe-stat-label">Submissions This Year</span>
      </div>
      <div class="cfe-stat">
        <span class="cfe-stat-value">${activeDays}</span>
        <span class="cfe-stat-label">Active Days</span>
      </div>
    </div>
    <div class="cfe-heatmap-container">
      <div class="cfe-month-row">${monthLabelHTML}</div>
      <div class="cfe-heatmap-grid">${gridHTML}</div>
      <div class="cfe-heatmap-legend">
        <span>Less</span>
        <div class="cfe-heatmap-cell" style="background: #1a1a2e"></div>
        <div class="cfe-heatmap-cell" style="background: rgba(0, 212, 170, 0.3)"></div>
        <div class="cfe-heatmap-cell" style="background: rgba(0, 212, 170, 0.55)"></div>
        <div class="cfe-heatmap-cell" style="background: rgba(0, 212, 170, 0.75)"></div>
        <div class="cfe-heatmap-cell" style="background: rgba(0, 212, 170, 1.0)"></div>
        <span>More</span>
      </div>
    </div>
  `
}

function buildUserDetails(user, socialLinks) {
  const details = []
  if (user.country) details.push({ label: '📍', value: user.country + (user.city ? `, ${user.city}` : '') })
  if (user.organization) details.push({ label: '🏢', value: user.organization })
  if (user.registrationTimeSeconds) {
    const date = new Date(user.registrationTimeSeconds * 1000)
    details.push({ label: '📅', value: `Member since ${date.toLocaleDateString('en', { month: 'long', year: 'numeric' })}` })
  }
  if (user.friendOfCount !== undefined) details.push({ label: '👥', value: `${user.friendOfCount} friends` })
  if (details.length === 0 && socialLinks.length === 0) return ''
  const detailsHTML = details.map(d => `
    <div class="cfe-detail-item">
      <span>${d.label}</span>
      <span class="cfe-detail-value">${d.value}</span>
    </div>
  `).join('')
  const socialHTML = socialLinks.length > 0 ? `
    <div class="cfe-social-links">
      ${socialLinks.map(l => `<a class="cfe-social-link" href="${l.href}" target="_blank">${l.label}</a>`).join('')}
    </div>
  ` : ''
  return `<div class="cfe-user-details">${detailsHTML}</div>${socialHTML}`
}

function getVerdictClass(verdict) {
  const map = { 'OK': 'cfe-verdict-ac', 'WRONG_ANSWER': 'cfe-verdict-wa', 'TIME_LIMIT_EXCEEDED': 'cfe-verdict-tle', 'MEMORY_LIMIT_EXCEEDED': 'cfe-verdict-mle', 'RUNTIME_ERROR': 'cfe-verdict-re', 'COMPILATION_ERROR': 'cfe-verdict-ce' }
  return map[verdict] || 'cfe-verdict-other'
}

function getVerdictLabel(verdict) {
  const map = { 'OK': 'AC', 'WRONG_ANSWER': 'WA', 'TIME_LIMIT_EXCEEDED': 'TLE', 'MEMORY_LIMIT_EXCEEDED': 'MLE', 'RUNTIME_ERROR': 'RE', 'COMPILATION_ERROR': 'CE' }
  return map[verdict] || (verdict ? verdict.slice(0, 4) : '?')
}

function buildRecentSubmissions(submissions) {
  if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
    return '<div style="color: var(--text-secondary); font-size: 13px; padding: 8px 0;">No submissions found</div>'
  }
  const rows = submissions.slice(0, 15).map(sub => {
    const name = sub.problem.name || `${sub.problem.contestId}${sub.problem.index}`
    const shortName = name.length > 28 ? name.slice(0, 28) + '…' : name
    const url = `https://codeforces.com/contest/${sub.problem.contestId}/problem/${sub.problem.index}`
    const date = new Date(sub.creationTimeSeconds * 1000)
    const dateStr = date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    const lang = sub.programmingLanguage ? sub.programmingLanguage.split(' ')[0] : '?'
    return `
      <tr>
        <td><a href="${url}" target="_blank" style="color: var(--accent); text-decoration: none;">${shortName}</a></td>
        <td><span class="cfe-verdict ${getVerdictClass(sub.verdict)}">${getVerdictLabel(sub.verdict)}</span></td>
        <td>${lang}</td>
        <td>${dateStr}</td>
      </tr>
    `
  }).join('')
  return `
    <table class="cfe-table">
      <thead><tr><th>Problem</th><th>Verdict</th><th>Language</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildBlogPosts(blog) {
  if (!blog || !blog.result || blog.result.length === 0) {
    return '<div style="color: var(--text-secondary); font-size: 13px; padding: 8px 0;">No blog posts found</div>'
  }
  return `
    <div class="cfe-blog-list">
      ${blog.result.slice(0, 10).map(post => {
        const date = new Date(post.creationTimeSeconds * 1000)
        const dateStr = date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
        return `
          <div class="cfe-blog-item">
            <a class="cfe-blog-title" href="https://codeforces.com/blog/entry/${post.id}" target="_blank">${post.title || 'Untitled'}</a>
            <span class="cfe-blog-meta">${dateStr}</span>
          </div>
        `
      }).join('')}
    </div>
  `
}

function buildRatingChartData(ratingHistory) {
  if (!ratingHistory || ratingHistory.length === 0) return { labels: [], data: [] }
  const labels = ratingHistory.map(r => {
    const date = new Date(r.ratingUpdateTimeSeconds * 1000)
    return date.toLocaleDateString('en', { month: 'short', year: '2-digit' })
  })
  const data = ratingHistory.map(r => r.newRating)
  return { labels, data }
}

function buildRecentContests(ratingHistory) {
  if (!ratingHistory || ratingHistory.length === 0) return []
  return [...ratingHistory].reverse().slice(0, 15)
}

function buildDashboardHTML(info, ratingHistory, submissions, blog, socialLinks) {
  const user = info.result[0]
  const contests = buildRecentContests(ratingHistory.result)
  const contestRows = contests.map(c => {
    const delta = c.newRating - c.oldRating
    const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`
    const deltaClass = delta >= 0 ? 'cfe-delta-positive' : 'cfe-delta-negative'
    const shortName = c.contestName.length > 60
      ? c.contestName.slice(0, 60) + '…'
      : c.contestName
    return `<tr><td>${shortName}</td><td>#${c.rank}</td><td>${c.newRating}</td><td class="${deltaClass}">${deltaStr}</td></tr>`
  }).join('')

  const userDetailsHTML = buildUserDetails(user, socialLinks)

  return `
    <div class="cfe-hero">
      <img class="cfe-avatar" src="${user.titlePhoto}" alt="${user.handle}" />
      <div class="cfe-hero-info">
        <div class="cfe-handle">${user.handle}</div>
        <div class="cfe-rank-badge" style="color: ${getRankColor(user.rank || 'newbie')}">${user.rank || 'Unrated'}</div>
        <div class="cfe-stats-row">
          <div class="cfe-stat">
            <span class="cfe-stat-value" style="color: var(--accent)">${user.rating || 'N/A'}</span>
            <span class="cfe-stat-label">Current Rating</span>
          </div>
          <div class="cfe-stat">
            <span class="cfe-stat-value">${user.maxRating || 'N/A'}</span>
            <span class="cfe-stat-label">Max Rating</span>
          </div>
          <div class="cfe-stat">
            <span class="cfe-stat-value">${ratingHistory.result ? ratingHistory.result.length : 0}</span>
            <span class="cfe-stat-label">Contests</span>
          </div>
          <div class="cfe-stat">
            <span class="cfe-stat-value">${user.contribution >= 0 ? '+' : ''}${user.contribution || 0}</span>
            <span class="cfe-stat-label">Contribution</span>
          </div>
        </div>
      </div>
    </div>

    ${userDetailsHTML ? `<div class="cfe-card-full" style="padding: 16px 20px;">${userDetailsHTML}</div>` : ''}

    <div class="cfe-card-full">
      <div class="cfe-card-title">Rating History</div>
      <canvas id="cfe-rating-chart" height="100"></canvas>
    </div>

<div class="cfe-card-full">
      <div class="cfe-card-title">Problems by Difficulty</div>
      <canvas id="cfe-problems-chart" height="120"></canvas>
    </div>

    <div class="cfe-card-full">
      <div class="cfe-card-title">Recent Contests</div>
      <table class="cfe-table">
        <thead><tr><th>Contest</th><th>Rank</th><th>Rating</th><th>Δ</th></tr></thead>
        <tbody>${contestRows}</tbody>
      </table>
    </div>

    <div class="cfe-card-full">
      <div class="cfe-card-title">Weakness Detection — Lowest Solve Rate by Topic</div>
      <canvas id="cfe-weakness-chart" height="80"></canvas>
    </div>

    <div class="cfe-card-full">
      <div class="cfe-card-title">Submission Activity</div>
      ${buildHeatmapHTML(submissions.result)}
    </div>

    <div class="cfe-cards-grid">
      <div class="cfe-card">
        <div class="cfe-card-title">Recent Submissions</div>
        ${buildRecentSubmissions(submissions.result)}
      </div>
      <div class="cfe-card">
        <div class="cfe-card-title">Blog Posts</div>
        ${buildBlogPosts(blog)}
      </div>
    </div>
  `
}

function renderCharts(ratingHistory, submissions) {
  const { labels, data } = buildRatingChartData(ratingHistory.result)
  const { groups } = processSubmissions(submissions.result)

  const ratingCtx = document.getElementById('cfe-rating-chart')
  if (ratingCtx) {
    new Chart(ratingCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#00d4aa',
          backgroundColor: 'rgba(0, 212, 170, 0.08)',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8888aa', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 12 }, grid: { color: '#1e1e2e' } },
          y: { ticks: { color: '#8888aa', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#1e1e2e' } }
        }
      }
    })
  }

  const problemsCtx = document.getElementById('cfe-problems-chart')
  if (problemsCtx) {
    new Chart(problemsCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(groups),
        datasets: [{
          data: Object.values(groups),
          backgroundColor: [
            'rgba(128, 128, 128, 0.8)',
            'rgba(0, 128, 0, 0.8)',
            'rgba(0, 128, 0, 0.8)',
            'rgba(3, 168, 158, 0.8)',
            'rgba(3, 168, 158, 0.8)',
            'rgba(0, 112, 255, 0.8)',
            'rgba(0, 112, 255, 0.8)',
            'rgba(170, 0, 170, 0.8)',
            'rgba(170, 0, 170, 0.8)',
            'rgba(255, 140, 0, 0.8)',
            'rgba(255, 140, 0, 0.8)',
            'rgba(255, 51, 51, 0.8)',
            'rgba(204, 0, 0, 0.8)',
          ],
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8888aa', font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#8888aa', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#1e1e2e' } }
        }
      }
    })
  }

  const weaknesses = processWeaknesses(submissions.result)
  const weaknessCtx = document.getElementById('cfe-weakness-chart')
  if (weaknessCtx && weaknesses.length > 0) {
    new Chart(weaknessCtx, {
      type: 'bar',
      data: {
        labels: weaknesses.map(w => w.tag),
        datasets: [{
          data: weaknesses.map(w => w.solveRate),
          backgroundColor: weaknesses.map(w => {
            if (w.solveRate < 40) return 'rgba(255, 77, 109, 0.8)'
            if (w.solveRate < 65) return 'rgba(255, 140, 0, 0.8)'
            return 'rgba(0, 212, 170, 0.8)'
          }),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const w = weaknesses[ctx.dataIndex]
                return ` ${w.solveRate}% solve rate (${w.solved}/${w.attempted})`
              }
            }
          }
        },
        scales: {
          x: { min: 0, max: 100, ticks: { color: '#8888aa', font: { family: 'JetBrains Mono', size: 10 }, callback: val => `${val}%` }, grid: { color: '#1e1e2e' } },
          y: { ticks: { color: '#e8e8f0', font: { family: 'JetBrains Mono', size: 11 } }, grid: { display: false } }
        }
      }
    })
  }
}

async function init() {
  const handle = getHandleFromURL()
  if (!handle) return

  const socialLinks = scrapeSocialLinks()

  const style = document.createElement('style')
  style.textContent = dashboardCSS
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = 'cf-enhancer-root'
  root.innerHTML = `
    <div style="color: #8888aa; font-family: 'JetBrains Mono', monospace; font-size: 13px; padding: 8px 0;">
      Loading CF Enhancer...
    </div>
  `

  const target = document.querySelector('#pageContent')
  if (!target) return
  target.prepend(root)

  Array.from(target.children).forEach(child => {
    if (child.id !== 'cf-enhancer-root') child.style.display = 'none'
  })

  chrome.runtime.sendMessage({ type: 'FETCH_USER_DATA', handle }, (response) => {
    if (response.error) {
      Array.from(target.children).forEach(child => {
        if (child.id !== 'cf-enhancer-root') child.style.display = ''
      })
      root.innerHTML = `<div style="color: #ff4d6d; font-family: monospace; padding: 8px 0;">Error: ${response.error}</div>`
      return
    }

    root.innerHTML = buildDashboardHTML(response.info, response.rating, response.status, response.blog, socialLinks)
    renderCharts(response.rating, response.status)
  })
}

init()