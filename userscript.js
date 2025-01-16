(function (window) {

	class GithubTimelineFilter {
		#labels = {
			comments: 'Comments',
			commits: 'Commits',
			pulls: 'Cross reference in pull request',
			issues: 'Cross reference in issues',
			reviews: 'Reviews',
			others: 'Other (labels, assignment, projects, …)'
		}

		#items = {
			comments: [],
			commits: [],
			pulls: [],
			issues: [],
			reviews: [],
			others: [],
		}

		#visibility = {
			comments: true,
			commits: true,
			pulls: true,
			issues: true,
			reviews: true,
			others: true,
		};

		#element = null
		#labelElements = []

		#storage = (typeof browser !== 'undefined') ? browser.storage.sync : chrome.storage.sync;

		#timer = null

		#elementLegacySelector = '.js-discussion'
		#elementSelector = `[data-testid="issue-viewer-container"], ${this.#elementLegacySelector}`;

		#legacyMode = false;

		#activeObservers = new Map();

		constructor() {
			this.#storage.get(['gtfShow'], (result) => this.#initialize(result.gtfShow))
		}

		#initialize(defaultVisibility) {
			if (defaultVisibility) {
				Object.assign(this.#visibility, defaultVisibility)
			}

			this.#createFilterElement()

			const observer = new MutationObserver(this.#bodyObserverCallback.bind(this));

			observer.observe(document.body, {
				childList: true,
				subtree: true
			});

			const element = document.querySelector(this.#elementSelector)

			if (element) {
				this.#initializeFilter(element)
			}
		}

		#bodyObserverCallback(mutationsList) {
			for (const mutation of mutationsList) {
				// Check removed nodes for cleanup
				mutation.removedNodes.forEach((node) => {
					if (node.nodeType === 1 && node.matches(this.#elementSelector)) {
						this.#destroyFilter(node);
					} else if (node.nodeType === 1) {
						const descendants = node.querySelectorAll(this.#elementSelector);
						descendants.forEach((descendant) => {
							this.#destroyFilter(descendant);
						});
					}
				});

				// Check added nodes for direct or descendant matches
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === 1 && node.matches(this.#elementSelector)) {
						this.#initializeFilter(node);
					} else if (node.nodeType === 1) {
						const descendants = node.querySelectorAll(this.#elementSelector);
						descendants.forEach((descendant) => {
							this.#initializeFilter(descendant);
						});
					}
				});
			}
		}

		#initializeFilter(element) {
			this.#legacyMode = element.matches(this.#elementLegacySelector)

			const observer = new MutationObserver(() => {
				this.#legacyMode ? this.#updateLegacyTimelineItems() : this.#updateTimelineItems();
				this.#updateItemsCount();
				this.#filterTimeline();
			});

			observer.observe(element, { childList: true, subtree: true });

			this.#activeObservers.set(element, observer)

			this.#legacyMode ? this.#updateLegacyTimelineItems() : this.#updateTimelineItems();
			this.#updateItemsCount();
			this.#filterTimeline();
		}

		#destroyFilter(element) {
			if (this.#activeObservers.has(element)) {
				this.#activeObservers.get(element).disconnect();
				this.#activeObservers.delete(element);

				this.#emptyTimelineItem();
				this.#updateItemsCount();
			}
		}

		#createFilterElement() {
			const element = document.createElement('div');
			element.classList.add('gtf', 'gtf--hidden');

			for (let type in this.#visibility) {
				let label = document.createElement('label');
				label.setAttribute('for', 'gtf-' + type);
				label.innerText = type[0].toUpperCase() + type.slice(1);
				label.title = this.#labels[type];
				label.dataset.type = type;
				label.dataset.count = 0;
				label.classList.add('gtf__item');

				let checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.id = 'gtf-' + type;
				checkbox.name = 'gtf';
				checkbox.classList.add('gtf__checkbox');
				checkbox.dataset.type = type;
				checkbox.checked = this.#visibility[type];
				checkbox.addEventListener('change', () => this.#toggleItemVisibility(checkbox));

				label.prepend(checkbox);
				element.append(label);

				this.#labelElements.push(label);
			}

			this.#element = element;
			document.body.append(element);
		}

		// Empty the timeline
		#emptyTimelineItem() {
			for (let key in this.#items) {
				this.#items[key] = []
			}
		}

		// This is used on issues
		#updateTimelineItems() {
			let timelineItems = Array.from(document.querySelectorAll('[class*=LayoutHelpers-module__timelineElement]:has([data-timeline-event-id])'));

			this.#items.comments = this.#getItemsByEventIdPrefix(timelineItems, 'IC_')
			timelineItems = timelineItems.filter((item) => ! this.#items.comments.includes(item));

			this.#items.commits = this.#getItemsByEventIdPrefix(timelineItems, 'REFE_')
			timelineItems = timelineItems.filter((item) => ! this.#items.commits.includes(item));

			this.#items.pulls = this.#getPulls(timelineItems)
			timelineItems = timelineItems.filter((item) => ! this.#items.pulls.includes(item));

			this.#items.issues = this.#getIssues(timelineItems)
			timelineItems = timelineItems.filter((item) => ! this.#items.issues.includes(item));

			this.#items.others = timelineItems
		}

		#getItemsByEventIdPrefix(items, prefix) {
			return items.filter((item) => {
				const dataItem = item.querySelector('[data-timeline-event-id]')
				return dataItem.dataset.timelineEventId.startsWith(prefix)
			})
		}

		#getPulls(items) {
			let crossReferenceItems = this.#getItemsByEventIdPrefix(items, 'CRE_')

			return crossReferenceItems.filter((item) => {
				return item.querySelector('[data-hovercard-url*="/pull/"]')
			})
		}

		#getIssues(items) {
			let crossReferenceItems = this.#getItemsByEventIdPrefix(items, 'CRE_')

			return crossReferenceItems.filter((item) => {
				return item.querySelector('[data-hovercard-url*="/issues/"]')
			})
		}

		#updateItemsCount() {
			let totalCount = 0

			this.#labelElements.forEach((label) => {
				totalCount += this.#items[label.dataset.type].length
				label.dataset.count = this.#items[label.dataset.type].length
			})

			this.#element?.classList.toggle('gtf--hidden', totalCount === 0);
		}

		// This is used on PRs
		#updateLegacyTimelineItems() {
			let timelineItems = Array.from(document.querySelectorAll('.js-timeline-item'));

			this.#items.comments = this.#getLegacyComments(timelineItems)
			timelineItems = timelineItems.filter((item) => ! this.#items.comments.includes(item));

			this.#items.commits = this.#getLegacyCommits(timelineItems)
			timelineItems = timelineItems.filter((item) => ! this.#items.commits.includes(item));

			this.#items.pulls = this.#getLegacyPulls(timelineItems)
			timelineItems = timelineItems.filter((item) => ! this.#items.pulls.includes(item));

			this.#items.issues = this.#getLegacyIssues(timelineItems)
			timelineItems = timelineItems.filter((item) => ! this.#items.issues.includes(item));

			this.#items.reviews = this.#getLegacyReviews(timelineItems)
			timelineItems = timelineItems.filter((item) => ! this.#items.reviews.includes(item));

			this.#items.others = timelineItems
		}

		#getLegacyComments(items) {
			return items.filter((item) => {
				return item.querySelector('.js-comment-container') &&
					!item.querySelector('[id*="pullrequestreview-"]');
			})
		}

		#getLegacyCommits(items) {
			return items.filter((item) => {
				return item.querySelector('[id*="commits-pushed-"]');
			});
		}

		#getLegacyPulls(items) {
			return items.filter((item) => {
				return item.querySelector('[data-hovercard-type="pull_request"]');
			});
		}

		#getLegacyIssues(items) {
			return items.filter((item) => {
				return item.querySelector('[data-hovercard-type="issue"]');
			});
		}

		#getLegacyReviews(items) {
			return items.filter((item) => {
				return item.querySelector('[id*="pullrequestreview-"]');
			})
		}

		#filterTimeline() {
			for (let type in this.#visibility) {
				this.#items[type].forEach((item) => {
					item.classList.toggle('gtf-hidden', ! this.#visibility[type])
				});
			}
		}

		#toggleItemVisibility(checkbox) {
			this.#visibility[checkbox.dataset.type] = checkbox.checked;

			this.#storage.set({ 'gtfShow': this.#visibility });

			this.#filterTimeline();
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener("DOMContentLoaded", function(e) {
			new GithubTimelineFilter();
		});
	}
	else {
		new GithubTimelineFilter();
	}

})(window);
