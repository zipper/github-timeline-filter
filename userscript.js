(function (window) {

	const labels = {
		comments: 'Comments',
		commits: 'Commits',
		pulls: 'Cross reference in pull request',
		issues: 'Cross reference in issues',
		others: 'Other (labels, assignment, projects, …)'
	};

	let items = {
		comments: null,
		commits: null,
		pulls: null,
		issues: null,
		others: null
	};

	let show = {
		comments: true,
		commits: true,
		pulls: true,
		issues: true,
		others: true
	};

	const extStorage = (typeof browser !== 'undefined') ? browser.storage.sync : chrome.storage.sync;

	function initExtension() {
		extStorage.get(['gtfShow'], result => {
			if (result.gtfShow) {
				Object.assign(show, result.gtfShow);
			}

			/* Take care of AJAX pagination */
			const targetNode = document.querySelector('.js-discussion');
			const observer = new MutationObserver(mutationsList => {
				updateTimelineItems();
				filterTimeline();
			});

			if (! targetNode) {
				return false;
			}

			observer.observe(targetNode, { childList: true, subtree: true });

			/* Initialize */
			createFilter();
			updateTimelineItems();
			filterTimeline();
		});
	}

	function toggleCheckbox() {
		show[this.dataset.type] = this.checked;

		extStorage.set({ 'gtfShow': show });

		filterTimeline();
	}

	function createFilter() {
		let div = document.createElement('div');
		div.classList.add('gtf');

		for (type in show) {
			if (show.hasOwnProperty(type)) {
				let label = document.createElement('label');
				label.setAttribute('for', 'gtf-' + type);
				label.innerText = type[0].toUpperCase() + type.slice(1);
				label.title = labels[type];
				label.classList.add('gtf__item');

				let checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.id = 'gtf-' + type;
				checkbox.name = 'gtf';
				checkbox.classList.add('gtf__checkbox');
				checkbox.dataset.type = type;
				checkbox.checked = show[type];
				checkbox.addEventListener('change', toggleCheckbox);

				label.prepend(checkbox);
				div.append(label);
			}
		}

		document.body.append(div);
	}

	function updateTimelineItems() {
		let timelineItems = document.querySelectorAll('.TimelineItem');
		timelineItems = Array.from(timelineItems);

		items.comments = timelineItems.filter(item => {
			return item.classList.contains('js-comment-container');
		});

		items.commits = timelineItems.filter(item => {
			return item.querySelector('.TimelineItem-body[id^="ref-commit-"]');
		});

		items.pulls = timelineItems.filter(item => {
			return item.querySelector('[data-hovercard-type="pull_request"]') &&
				! item.classList.contains('js-comment-container') &&
				! item.querySelector('.TimelineItem-body[id^="ref-commit-"]');
		});

		items.issues = timelineItems.filter(item => {
			return item.querySelector('[data-hovercard-type="issue"]') &&
				! item.classList.contains('js-comment-container') &&
				! item.querySelector('.TimelineItem-body[id^="ref-commit-"]');
		});

		items.others = timelineItems.filter(item => {
			return items.comments.indexOf(item) === -1 && items.commits.indexOf(item) === -1 &&
				items.pulls.indexOf(item) === -1 && items.issues.indexOf(item) === -1;
		});
	}

	function filterTimeline() {
		for (type in show) {
			if (items.hasOwnProperty(type)) {
				items[type].forEach(item => {
					if (! show[type]) {
						// console.log("Hide:", item, type);
						item.classList.add('gtf-hidden');
					} else {
						// console.log("Show:", item, type);
						item.classList.remove('gtf-hidden');
					}
				});
			}
		}
	}


	if (document.readyState === 'loading') {
		document.addEventListener("DOMContentLoaded", function(e) {
			initExtension();
		});
	}
	else {
		initExtension();
	}

})(window);
