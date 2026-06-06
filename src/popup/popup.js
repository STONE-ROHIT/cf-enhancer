import popupCSS from './popup.css?inline'

const style = document.createElement('style')
style.textContent = popupCSS
document.head.appendChild(style)

const input = document.getElementById('handle-input')
const searchBtn = document.getElementById('search-btn')
const errorMsg = document.getElementById('error-msg')
const currentBtn = document.getElementById('current-btn')

function navigateToProfile(handle) {
  const trimmed = handle.trim()
  if (!trimmed) {
    errorMsg.classList.remove('hidden')
    return
  }
  errorMsg.classList.add('hidden')
  chrome.tabs.create({ url: `https://codeforces.com/profile/${trimmed}` })
  window.close()
}

searchBtn.addEventListener('click', () => {
  navigateToProfile(input.value)
})

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') navigateToProfile(input.value)
})

input.addEventListener('input', () => {
  errorMsg.classList.add('hidden')
})

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0]
  const match = tab.url && tab.url.match(/codeforces\.com\/profile\/(.+)/)
  if (match) {
    currentBtn.textContent = `View ${match[1]}'s Profile`
    currentBtn.addEventListener('click', () => {
      chrome.tabs.update(tab.id, { active: true })
      window.close()
    })
  } else {
    currentBtn.disabled = true
    currentBtn.style.opacity = '0.4'
    currentBtn.style.cursor = 'not-allowed'
    currentBtn.textContent = 'Not on a Codeforces profile'
  }
})