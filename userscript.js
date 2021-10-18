(function (window) {

	const labels = {
		comments: 'Comments',
		commits: 'Commits',
		pulls: 'Cross reference in pull request',
		issues: 'Cross reference in issues',
		deployments: 'Deployments',
		others: 'Other (labels, assignment, projects, …)'
	};

	let items = {
		comments: null,
		commits: null,
		pulls: null,
		issues: null,
		deployments: null,
		others: null
	};

	let show = {
		comments: true,
		commits: true,
		pulls: true,
		issues: true,
		deployments: true,
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

			/* Handle AJAX page load */
			document.documentElement.addEventListener('pjax:complete', (e) => {
				updateTimelineItems();
				filterTimeline();
			});

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
			return item.classList.contains('js-comment-container') || // generic comments
				item.closest('.js-comment') || // review comments
				item.querySelector('.js-comment-container');
		});
		timelineItems = timelineItems.filter(item => !items.comments.includes(item));

		items.commits = timelineItems.filter(item => {
			return item.querySelector('.TimelineItem-body[id^="ref-commit-"]') || // commits in issue detail
				item.classList.contains('js-commit-group-header') || // commits in PR
				item.classList.contains('js-commit') ||
				item.closest('.js-commit-group-commits');
		});
		timelineItems = timelineItems.filter(item => !items.commits.includes(item));

		items.pulls = timelineItems.filter(item => {
			return item.querySelector('[data-hovercard-type="pull_request"]');
		});
		timelineItems = timelineItems.filter(item => !items.pulls.includes(item));

		items.issues = timelineItems.filter(item => {
			return item.querySelector('[data-hovercard-type="issue"]');
		});
		timelineItems = timelineItems.filter(item => !items.issues.includes(item));

		items.deployments = timelineItems.filter(item => {
			return item.matches('[id^="event-"]') &&
				item.parentNode.matches('[data-url*="/events/deployed"]');
		});
		timelineItems = timelineItems.filter(item => !items.deployments.includes(item));

		items.others = timelineItems;
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
