const bar = document.getElementById('bar')
const panel = document.getElementById('panel')

bar.addEventListener('click', () => {
    const isOpen = panel.style.display === 'block'
    panel.style.display = isOpen ? 'none' : 'block'
})