import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tab", "iframe", "tabBar", "iframeContainer"]

  connect() {
    // Ensure first tab is active
    if (this.tabTargets.length > 0 && !this.hasActiveTab()) {
      this.activateTab(this.tabTargets[0])
    }
    
    // Listen for terminal create requests
    this.element.addEventListener('terminal:create', async (event) => {
      const { directory, instanceName } = event.detail
      await this.createTerminal(directory, instanceName)
    })
    
    // Watch for tab removals via MutationObserver
    this.observeTabRemovals()
  }

  switchTab(event) {
    const tab = event.currentTarget
    
    // Don't do anything if this tab is already active
    if (tab.classList.contains("bg-gray-800")) {
      return
    }
    
    this.activateTab(tab)
  }

  activateTab(tab) {
    // Remove active class from all tabs
    this.tabTargets.forEach(t => {
      t.classList.remove("bg-gray-800", "text-white", "cursor-default")
      t.classList.add("bg-gray-900", "text-gray-300", "cursor-pointer")
    })

    // Add active class to clicked tab
    tab.classList.remove("bg-gray-900", "text-gray-300", "cursor-pointer")
    tab.classList.add("bg-gray-800", "text-white", "cursor-default")

    // Update iframe src
    const url = tab.dataset.tabUrl
    this.iframeTarget.src = url
    this.iframeTarget.dataset.tabId = tab.dataset.tabId
  }

  hasActiveTab() {
    return this.tabTargets.some(tab => tab.classList.contains("bg-gray-800"))
  }

  openTerminalPicker(event) {
    // Show git status dropdown to allow directory selection
    const gitStatusButton = document.querySelector('[data-controller="dropdown-hover"][data-dropdown-hover-has-items-value="true"]')
    if (gitStatusButton) {
      // Trigger hover on git status to show directories
      gitStatusButton.dispatchEvent(new MouseEvent('mouseenter'))
    } else {
      alert("Please ensure the session is active and git status is loaded.")
    }
  }

  async createTerminal(directory, instanceName) {
    const sessionId = window.location.pathname.match(/sessions\/(\d+)/)[1]
    
    try {
      const response = await fetch(`/sessions/${sessionId}/create_terminal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
          directory: directory,
          instance_name: instanceName
        })
      })

      const data = await response.json()
      
      if (data.success) {
        this.addTerminalTab(data.terminal)
      } else {
        alert(`Failed to create terminal: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating terminal:', error)
      alert('Failed to create terminal')
    }
  }

  addTerminalTab(terminal) {
    // Create tab element
    const tab = document.createElement('div')
    tab.id = `terminal_tab_${terminal.id}`
    tab.dataset.terminalTabsTarget = 'tab'
    tab.dataset.tabId = terminal.id
    tab.dataset.tabUrl = terminal.url
    tab.dataset.action = 'click->terminal-tabs#switchTab'
    tab.className = 'group px-4 py-2 bg-gray-900 text-gray-300 border-r border-gray-700 flex items-center space-x-2 hover:bg-gray-800 hover:text-white transition-colors min-w-0 relative cursor-pointer'
    
    tab.innerHTML = `
      <svg class="h-4 w-4 flex-shrink-0 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3.25 3A2.25 2.25 0 001 5.25v9.5A2.25 2.25 0 003.25 17h13.5A2.25 2.25 0 0019 14.75v-9.5A2.25 2.25 0 0016.75 3H3.25zm.943 8.752a.75.75 0 01.055-1.06L6.128 9l-1.88-1.693a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 01-1.06-.055zM9.75 10.25a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" clip-rule="evenodd" />
      </svg>
      <span class="truncate max-w-[150px]" title="${terminal.directory}">${terminal.name}</span>
      
      <!-- Close button (always visible) -->
      <button type="button"
        data-action="click->terminal-tabs#closeTerminal"
        data-terminal-id="${terminal.id}"
        class="ml-2 p-0.5 rounded hover:bg-red-600/20"
        title="Close terminal"
        onclick="event.stopPropagation()">
        <svg class="h-3 w-3 text-gray-400 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `
    
    // Add tab to container
    const container = document.getElementById('terminal_tabs_container')
    if (container) {
      container.appendChild(tab)
    }
    
    // Force Stimulus to refresh tab targets
    this.dispatch('tab-added', { detail: { terminalId: terminal.id } })
    
    // Switch to the new terminal tab
    this.activateTab(tab)
  }

  observeTabRemovals() {
    const container = document.getElementById('terminal_tabs_container')
    if (!container) {
      console.error('Terminal tabs container not found')
      return
    }
    
    console.log('Setting up mutation observer for terminal tab removals')
    
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          console.log('Node removed:', node)
          // Check if the removed node was the active tab
          if (node.nodeType === 1 && node.classList && node.classList.contains('bg-gray-800')) {
            console.log('Active tab was removed, switching to swarm tab')
            // Find the swarm tab and activate it
            const swarmTab = this.element.querySelector('[data-tab-id="swarm"]')
            if (swarmTab) {
              this.activateTab(swarmTab)
            }
          }
        })
      })
    })
    
    // Observe only direct children being removed
    this.observer.observe(container, { childList: true })
  }
  
  disconnect() {
    if (this.observer) {
      this.observer.disconnect()
    }
  }

  async closeTerminal(event) {
    event.stopPropagation()
    const terminalId = event.currentTarget.dataset.terminalId
    const tab = document.getElementById(`terminal_tab_${terminalId}`)
    
    // If this is the active tab, switch to another tab first
    if (tab.classList.contains("bg-gray-800")) {
      const otherTabs = this.tabTargets.filter(t => t.dataset.tabId !== terminalId)
      if (otherTabs.length > 0) {
        this.activateTab(otherTabs[0])
      }
    }
    
    // Call server to kill the terminal session
    const sessionId = window.location.pathname.match(/sessions\/(\d+)/)[1]
    
    try {
      const response = await fetch(`/sessions/${sessionId}/kill_terminal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({
          terminal_id: terminalId
        })
      })
      
      if (!response.ok) {
        console.error('Failed to kill terminal')
        // Still remove the tab even if the request fails
      }
    } catch (error) {
      console.error('Error killing terminal:', error)
    }
    
    // Remove the tab
    tab.remove()
  }
}