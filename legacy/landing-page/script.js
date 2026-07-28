/**
 * Alterna o estado da sidebar entre Expandido (Menu 2) e Recolhido (Menu 1)
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');

    if (sidebar.classList.contains('sidebar-expanded')) {
        sidebar.classList.remove('sidebar-expanded');
        sidebar.classList.add('sidebar-collapsed');
    } else {
        sidebar.classList.remove('sidebar-collapsed');
        sidebar.classList.add('sidebar-expanded');
    }
}

function selectSection(sectionId) {
    const screens = document.querySelectorAll('[data-screen]');
    screens.forEach(screen => {
        screen.classList.add('hidden');
    });

    const selected = document.getElementById(`section-${sectionId}`);
    if (selected) {
        selected.classList.remove('hidden');
    }

    const menuItems = document.querySelectorAll('.sidebar-item');
    menuItems.forEach(item => {
        item.classList.remove('active', 'text-blue-800');
        item.classList.add('text-slate-500');
    });

    const activeItem = document.querySelector(`.sidebar-item[data-section="${sectionId}"]`);
    if (activeItem) {
        activeItem.classList.add('active', 'text-blue-800');
        activeItem.classList.remove('text-slate-500');
    }
}

function setCurrentDate() {
    const currentDateElement = document.getElementById('current-date');
    if (currentDateElement) {
        const date = new Date();
        const options = { weekday: 'long', day: '2-digit', month: 'long' };
        currentDateElement.textContent = date.toLocaleDateString('pt-BR', options);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    selectSection('home');
    setCurrentDate();
});
