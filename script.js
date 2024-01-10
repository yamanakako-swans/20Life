document.addEventListener('DOMContentLoaded', () => {
	console.log("DOM fully loaded and parsed");
    const grid = document.querySelector('#grid');
    const buttons = selectButtons(['#start', '#stop', '#forwardStep', '#backwardStep', '#clear', '#rewind']);
    const {startButton, stopButton, forwardStepButton, backwardStepButton, clearButton, rewindButton} = buttons;
    const title = document.getElementById('title');
    const overlay = document.getElementById('overlay'); // Assuming you have an overlay element
    const gridSize = 20; // The size of the grid

    let {timer, cells, history, future, rewindTimer, isMouseDown, isWaitingForInteraction, isInGracePeriod, gracePeriodTimeout} = initializeState();
    const gracePeriodDuration = 3000; // Duration of the grace period in milliseconds

    initializeGrid();
    bindEvents();

    animateTitle();

	

    function initializeState() {
        return {
            timer: null,
            cells: [],
            history: [],
            future: [],
            rewindTimer: null,
            isMouseDown: false,
            isWaitingForInteraction: false,
            isInGracePeriod: false,
            gracePeriodTimeout: null
        };
    }

	function selectButtons(ids) {
		return ids.reduce((acc, id) => {
			const propName = id.replace('#', '') + 'Button';
			acc[propName] = document.querySelector(id);
			return acc;
		}, {});
	}	

    // Define all functions below
    function initializeGrid() {
        for (let i = 0; i < gridSize * gridSize; i++) {
            const cell = document.createElement('div');
            cell.addEventListener('click', () => {
                cell.classList.toggle('alive');
            });
            grid.appendChild(cell);
            cells.push(cell);
        }
    }

    function bindEvents() {
        startButton.addEventListener('click', startGame);
        stopButton.addEventListener('click', stopGame);
        forwardStepButton.addEventListener('click', forwardStep);
        backwardStepButton.addEventListener('click', backwardStep);
        clearButton.addEventListener('click', clearBoard);
        rewindButton.addEventListener('click', startRewind);

        grid.addEventListener('mousedown', () => {
            isMouseDown = true;
        });

        document.addEventListener('mouseup', () => {
            isMouseDown = false;
        });

        grid.addEventListener('mouseover', event => {
            if (isMouseDown && event.target.matches('#grid div')) {
                event.target.classList.toggle('alive');
                if (isWaitingForInteraction) {
                    startGame();
                }
            }
        });
    }

	
    function isBoardEmpty() {
        return cells.every(cell => !cell.classList.contains('alive'));
    }

	function isBoardStable() {
		// A board is stable if it's empty or if the last few recorded states are the same.
		if (isBoardEmpty() || history.length < 2) return false;
		
		const latestStateHash = history[history.length - 1].hash; // Ensure you use .hash to access the string representation
		// Check the last few states to see if they are all the same.
		for (let i = history.length - 2; i >= 0; i--) {
			if (history[i].hash !== latestStateHash) { // Again, use .hash
				// Found a state that is different, board is not stable.
				return false;
			}
		}
		// All checked states are the same, board is stable.
		return true;
	}
	
	
	

	function currentState() {
		return cells.map(cell => cell.classList.contains('alive'));
	}

	function applyState(state) {
		cells.forEach((cell, index) => {
			if(state[index]) {
				cell.classList.add('alive');
			} else {
				cell.classList.remove('alive');
			}
		});
	}

	// Function to briefly highlight a button

	function flashButtonActive(button) {
		button.classList.add('button-active');
		setTimeout(() => {
			button.classList.remove('button-active');
		}, 200); // Time in milliseconds to keep the button highlighted
	}

    function computeNextGeneration() {
		if (isWaitingForInteraction) {
			isWaitingForInteraction = false;
			isInGracePeriod = true;
			gracePeriodTimeout = setTimeout(() => {
				isInGracePeriod = false;
			}, gracePeriodDuration);
		}
    
        const newCells = cells.map((cell, index) => {
			// Logic to compute alive or dead for each cell.
            let alive = 0;
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    if (i === 0 && j === 0) continue;
                    const x = index % gridSize + i;
                    const y = Math.floor(index / gridSize) + j;
                    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
                        if (cells[y * gridSize + x].classList.contains('alive')) {
                            alive++;
                        }
                    }
                }
            }
            if (cell.classList.contains('alive') && (alive < 2 || alive > 3)) {
                return false;
            }
            if (!cell.classList.contains('alive') && alive === 3) {
                return true;
            }
            return cell.classList.contains('alive');
        });

		// Apply the new state to the grid.
        applyState(newCells);

    	// Save the state after computing the new generation but before checking for oscillation
    	saveState();

	    // Check for a stable state and stop the game if it's stable
	    if (isBoardStable()) {
	        console.log('Board is stable, stopping game.');
	        stopGame();
	        return; // Return early to prevent further execution
	    }

        // Handle oscillations.
	    const oscillationPeriod = detectOscillation();
	    if (oscillationPeriod > 1) { // Ignore period of 1 as it's not a true oscillation.
	        console.log(`Oscillation with a period of ${oscillationPeriod} detected.`);
	        stopGame(); // Stop automatic operation if oscillation is detected.
	    } else if (isBoardStable()) {
	        console.log('Board is stable, stopping game.');
	        stopGame();
	    }
    }

    function hashState(state) {
		// A simple hash might concatenate the state values (e.g., "alive" or "dead" for each cell).
		return state.map(cell => cell ? '1' : '0').join('');
	}
	
	function detectOscillation() {
		// Assuming history contains hashes of past states
		const currentStateHash = hashState(cells.map(cell => cell.classList.contains('alive')));
		const previousOscillation = history.find(entry => entry.hash === currentStateHash);
	
		if (previousOscillation) {
			const oscillationPeriod = history.length - previousOscillation.index;
			if (oscillationPeriod > 1) { // Ignore oscillations of period 1
				console.log(`Oscillation detected with a period of: ${oscillationPeriod}`);
				return oscillationPeriod;
			}
		}
		return 0; // No oscillation or period 1 detected
	}
	
	function saveState() {
		// Update to store state hashes and their indices
		const currentState = cells.map(cell => cell.classList.contains('alive'));
		const currentStateHash = hashState(currentState);
		
		// Push the new state to the history
		history.push({ state: currentState, hash: currentStateHash });
		console.log('Saving state:', JSON.stringify(history, null, 2)); // To log the saved state

		// Prune history if it exceeds a certain length, e.g., 100
		const maxHistoryLength = 100;
		if (history.length > maxHistoryLength) {
			history.shift(); // This removes the oldest element from the history array
		}
	}	
	
	function forwardStep() {
		// This function handles the manual advancement of the game by one generation.
		console.log('Before forwardStep:', history);
		computeNextGeneration();
		checkForOscillationAndHandle(); // This will check for any oscillation and handle it.
		console.log('After forwardStep:', history);
	}

	function backwardStep() {
		// This function handles the manual reversal of the game by one generation.
		console.log('Before backwardStep:', JSON.stringify(history, null, 2)); // Added JSON.stringify for better readability in the log
		if (history.length > 1) { // Ensure there's a previous state to revert to
			const prevState = history.pop(); // Remove the last state
			future.push(currentState()); // Save the current state in future before going back
			applyState(prevState.state); // Apply the previous state to the grid
		} else {
			console.log("No more states to revert to.");
		}
		console.log('After backwardStep:', JSON.stringify(history, null, 2)); // Added JSON.stringify for better readability in the log
	}

	function startGame() {
		// Starts automatic forward stepping.
		console.log("startGame function is called");
		stopGame(); // Ensure the game isn't running in reverse
		if (!timer) {
			if (isBoardEmpty()) {
				isWaitingForInteraction = true;
				startButton.classList.add('button-active');
			} else { // Immediately start if the board is not empty
				timer = setInterval(forwardStep, 100); // Continuously call forwardStep every 100ms 
			}
		}
		future = []; // Reset future when game starts 
	}

	function startRewind() {
		// Starts automatic backward stepping.
		console.log("Rewind function called");
    	stopGame(); // Stop any existing interval
    	if (history.length > 1) { // Check if there are states to rewind
    	    rewindTimer = setInterval(backwardStep, 100);
    	} else {
    	    console.log("No history to rewind through.");
    	    stopGame(); // No history, so stop rewind
    	}
	}

	function stopGame() {
		console.log("stopGame function is called");
		clearInterval(timer);  // Stop the main game interval
		clearInterval(rewindTimer); // Stop automatic reverse
		clearTimeout(gracePeriodTimeout);  // Clear the timeout for the grace period
	
		timer = null;
		rewindTimer = null;
		isWaitingForInteraction = false;  // Reset the waiting flag
		isInGracePeriod = false;  // Reset the grace period flag
	
		startButton.classList.remove('button-active');  // Remove the active class from the start button
	
		document.querySelector('#rewind').classList.remove('button-active');  // Remove the active class from the rewind button, if necessary
	}

	function checkForOscillationAndHandle() {
		// Check for oscillation after computing the next generation.
		const oscillationPeriod = detectOscillation();
		if (oscillationPeriod > 1) { // Ignore period of 1 as it's not a true oscillation.
			console.log(`Oscillation with a period of ${oscillationPeriod} detected.`);
			stopGame(); // Stop automatic operation if oscillation is detected.
		}
	}

    function clearBoard() {
        cells.forEach(cell => cell.classList.remove('alive'));
        history = [];
        stopGame();
        flashButtonActive(clearButton); // Flash the clear (reset) button
		isWaitingForInteraction = false;
		history = [];
		future = []; // Clear both history and future on reset
	}

	function animateTitle() {
        console.log("animateTitle function is called");
        // Adding a delay to ensure the DOM is fully ready
        setTimeout(() => {
            const title = document.getElementById('title');
            if (title) {
                title.classList.add('final');
				overlay.classList.add('hide-overlay');
                console.log("final class added to title");
            } else {
                console.error("Title element not found");
            }
        }, 1000); // You can adjust this delay as needed
    }
	
});
