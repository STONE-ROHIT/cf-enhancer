async function fetchUserData(handle) {
  try {
    const [infoRes, ratingRes, statusRes, blogRes] = await Promise.all([
      fetch(`https://codeforces.com/api/user.info?handles=${handle}`),
      fetch(`https://codeforces.com/api/user.rating?handle=${handle}`),
      fetch(`https://codeforces.com/api/user.status?handle=${handle}&count=1000`),
      fetch(`https://codeforces.com/api/user.blogEntries?handle=${handle}`)
    ])

    const [info, rating, status, blog] = await Promise.all([
      infoRes.json(),
      ratingRes.json(),
      statusRes.json(),
      blogRes.json()
    ])

    return { info, rating, status, blog }
  } catch (error) {
    return { error: error.message }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_USER_DATA') {
    fetchUserData(message.handle).then(sendResponse)
    return true
  }
})