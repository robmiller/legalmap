/*jslint nomen: true, browser: true */
var LegalMap = function () {
	"use strict";

	var self = this;

	this.countries = {};
	this.uniques = {};
	this.glossary = {};
	this.activeFilters = { treaties: [], memberships: [], situations: [], deathPenalty: [] };

	this.init = function () {
		self.map = new GMaps({
			div: '#map',
			lat: 0,
			lng: 0,
			zoom: 2,
			mapTypeControl: false,
			streetViewControl: false,
			scaleControl: false
		});

		self.fetchGlossary(self.fetchCountries);

		$(window).resize(self.resizeMap);

		// Provide actions for the filter buttons.
		$(document).on('click', 'button:not(#showall)', function () {
			var button = this,
				new_state = self.toggleButton(button);

			_.each(
				['treaties', 'memberships', 'situations', 'deathPenalty'],
				function (type) {
					var filter_value = $(button).data(type.toLowerCase());
					if ( typeof filter_value !== 'undefined' ) {
						if ( new_state === 'on' ) {
							// If we're adding a filter, we need to push onto the activeFilters array.
							self.activeFilters[type].push(filter_value);
						} else {
							// If we're removing a filter, then we need to remove an element from the activeFilters array.
							self.activeFilters[type].splice([_.indexOf(self.activeFilters[type], filter_value)], 1); 
						}
					}
				}
			);

			self.filterCountries();
		});

		$('button#showall').click(function () {
			self.clearCountries();
			self.showAllCountries();
		});

		$('a#togglefilters').click(function (e) { e.preventDefault(); self.toggleFilters(); });
	};

	this.toggleButton = function (button) {
		var new_state = 'off';

		if ( $(button).data('state') === 'on' ) {
			$(button).text($(button).text().replace(' ✔', ''));
		} else {
			$(button).text($(button).text() + ' ✔');
			new_state = 'on';
		}

		$(button).data('state', new_state);
		return new_state;
	};

	this.fetchGlossary = function (callback) {
		$.getJSON('glossary.txt', function (data) {
			self.glossary = data;
			if (callback) {
				callback();
			}
		});
	};

	this.fetchCountries = function () {
		$.getJSON('countries.txt', function (data) {
			self.countries = data;
			// Initially, add all countries.
			self.showAllCountries();
			// Parse out the unique values, in order to generate our filter buttons.
			self.findUniques();
			self.generateFilterButtons();

			self.resizeMap();
		});
	};

	this.getCountries = function (filter) {
		var filtered = self.countries,
			search;

		search = function (type, values) { return _.filter(self.countries, function (country) { return _.intersection(country[type], values).length === values.length; }); };

		if (filter.treaties.length > 0) {
			filtered = _.intersection(filtered, search("treaties", filter.treaties));
		}
		if (filter.memberships.length > 0) {
			filtered = _.intersection(filtered, search("memberships", filter.memberships));
		}
		if (filter.situations.length > 0) {
			filtered = _.intersection(filtered, search("situations", filter.situations));
		}
		if (filter.deathPenalty.length > 0) {
			filtered = _.intersection(filtered, _.filter(self.countries, function (country) { return _.indexOf(filter.deathPenalty, parseInt(country.deathPenalty, 10)) !== -1; }));
		}

		return filtered;
	};

	this.findUniques = function () {
		_.each(['treaties', 'memberships', 'situations'], function (type) {
			self.uniques[type] = _.unique(_.flatten(_.pluck(self.countries, type)));
		});
	};

	this.generateFilterButtons = function () {
		_.each(self.uniques, function (uniques, type) {
			_.each(uniques, function (name) {
				if (!name) {
					return;
				}

				var longName, classes, button, original_name;

				original_name = name;

				longName = name;
				if (typeof self.glossary[name] === 'object') {
					longName = self.glossary[name].longName || name;
					name = self.glossary[name].name || name;
				}
				if (typeof self.glossary[name] === 'string') {
					longName = self.glossary[name];
					name = self.glossary[name];
				}

				classes = 'btn';
				if (type === 'treaties') {
					classes += ' btn-inverse';
				}
				if (type === 'situations') {
					classes += ' btn-info';
				}

				button = $('<button />')
					.addClass(classes)
					.data(type, original_name)
					.text(name);

				if (name !== longName) {
					button.attr('title', longName);
				}

				button.appendTo($('#' + type));
			});
		});
	};

	this.makeList = function (title, items) {
		if (items.length < 1) {
			return '';
		}

		var html = '<h4>' + title + '</h4>';
		html += '<ul>';
		_.each(items, function (item) {
			html += '<li>' + item + '</li>';
		});

		return html += '</ul>';
	};

	this.addCountry = function (country) {
		var infoWindow = '<h3>' + country.name + '</h3>';

		infoWindow += self.makeList('Treaties signed:', country.treaties);
		infoWindow += self.makeList('Current situations:', country.situations);
		infoWindow += self.makeList('Memberships:', country.memberships);

		infoWindow += '<h4>Death penalty:</h4><ul>';
		if (country.deathPenalty === 0) {
			infoWindow += '<li>Abolished</li>';
		}
		if (country.deathPenalty === 1) {
			infoWindow += '<li><i>De-facto</i> abolished</li>';
		}
		if (country.deathPenalty === 2) {
			infoWindow += '<li>Still in use</li>';
		}
		infoWindow += '</ul>';

		try {
			self.map.addMarker({
				lat: country.lat,
				lng: country.lng,
				title: country.name,
				infoWindow: {
					content: infoWindow
				}
			});
		} catch (e) {
			//console.log(country.name);
		}
	};

	this.clearCountries = function () {
		self.map.removeMarkers();
	};

	this.clearFilters = function () {
		self.activeFilters = { treaties: [], memberships: [], situations: [], deathPenalty: [] };
		$('button').each(function () {
			$(this).text($(this).text().replace(' ✔', ''));
			$(this).data('state', 'off');
		});
	};

	this.showAllCountries = function () {
		self.clearFilters();
		_.each(self.countries, function (country) {
			self.addCountry(country);
		});
	};

	this.filterCountries = function () {
		self.clearCountries();
		var matchedCountries = self.getCountries(self.activeFilters);
		_.each(matchedCountries, function (country) { self.addCountry(country); });
	};

	this.resizeMap = function () {
		// Size the map according to the viewport.
		var height = $(window).height();
		if ($('.top:visible').length > 0) {
			height -= $('.top').height();
		}
		height -= $('.below').height();
		height -= 50;
		$('#map').height(height);

		// If we don't also tell the Google Map that we've resized, 
		// we'll end up with odd visual artefacts (like grey squares).
		google.maps.event.trigger(self.map.map, 'resize');
	};

	this.toggleFilters = function () {
		var toggle = $('a#togglefilters'),
			action = '',
			icon = '',
			text = '';

		if (toggle.data('action') === 'close') {
			action = 'open';
			icon = 'icon-arrow-down';
			text = 'Open filters';
			$('.top').slideUp(function () { self.updateToggle(action, icon, text); });
		} else {
			action = 'close';
			icon = 'icon-arrow-up';
			text = 'Close filters';
			$('.top').slideDown(function () { self.updateToggle(action, icon, text); });
		}
	};

	this.updateToggle = function (action, icon, text) {
		var toggle = $('a#togglefilters');
		toggle.data('action', action);
		toggle.find('i').attr('class', icon);
		toggle.find('span').text(text);

		self.resizeMap();
	};

};

var legalMap = new LegalMap();

$(legalMap.init);
