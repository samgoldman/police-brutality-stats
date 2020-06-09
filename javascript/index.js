let global_data = null;
let map_data = null;
let state_stats = null;
let city_stats = null;
let date_stats = null;
let state_names = null;

const SVG_WIDTH = 1200;
const SVG_HEIGHT = SVG_WIDTH * (4.0/6.0);

const updateCounters = () => {
	document.querySelector('#case_count').innerText = global_data['data'].length;
	document.querySelector('#state_count').innerText = state_stats.size - 1;  // Don't count unknown location
	document.querySelector('#city_count').innerText = city_stats.size - 1;  // Don't count empty city
	document.querySelector('#date_count').innerText = date_stats.size;
};

let color = null;
const initStateMap = () => {
	const svg = d3.select('#map_svg')
		.attr('width', SVG_WIDTH)
		.attr('height', SVG_HEIGHT);

	const path = d3.geoPath();

	const state_domain = [state_stats.values().length !== 51 ? 0 : d3.min(state_stats.values()),
		d3.max(state_stats.values())];

	const state_thresholds = d3.range(state_domain[0], state_domain[1], (state_domain[1] - state_domain[0]) / 9);

	const x = d3.scaleLinear()
		.domain(state_domain)
		.range([SVG_WIDTH - 600, SVG_WIDTH - 350]);

	color = d3.scaleThreshold()
		.domain(state_thresholds)
		.range(d3.schemeReds[9]);

	const g = svg.append('g')
		.attr('class', 'key')
		.attr('transform', 'translate(0,40)');

	const div = d3.select("body").append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);

	g.selectAll('rect')
		.data(color.range().map(d => {
			d = color.invertExtent(d);
			if (d[0] == null) d[0] = x.domain()[0];
			if (d[1] == null) d[1] = x.domain()[1];
			return d;
		}))
		.enter().append('rect')
		.attr('height', 8)
		.attr('x', d => {
			return x(d[0])
		})
		.attr('width', d => x(d[1]) - x(d[0]))
		.attr('fill', d => color(d[0]));

	g.append('text')
		.attr('class', 'caption')
		.attr('x', x.range()[0])
		.attr('y', -6)
		.attr('fill', '#000')
		.attr('text-anchor', 'start')
		.attr('font-weight', 'bold')
		.attr('font-size', 16)
		.text('Number of Incidents');

	g.call(d3.axisBottom(x)
		.tickSize(13)
		.tickFormat((x, i) => i < state_thresholds.length - 1 ? Math.round(x) : '')
		.tickValues(state_thresholds))
		.select('.domain')
		.remove();

	svg.append('g')
		.attr('class', 'states')
		.selectAll('path')
		.data(topojson.feature(map_data, map_data.objects.states).features)
		.enter().append('path')
		.attr('fill', d => state_stats.get(state_names[parseInt(d.id)]) === undefined ? '#ccc' : color(state_stats.get(state_names[parseInt(d.id)])))
		.attr('d', path)
		.attr('stroke', '#000')
		.on("mouseover", function(d) {
			div.transition()
				.duration(200)
				.style("opacity", .9);
			const val = state_stats.get(state_names[parseInt(d.id)]);
			div.text(`${state_names[parseInt(d.id)]}: ${val === undefined ? 'No Data' : val}`)
				.style("left", (d3.event.pageX) + "px")
				.style("top", (d3.event.pageY) + "px");
		});
};

const initTimeSeries = () => {

	const margin = {top: 20, right: 25, bottom: 50, left: 25};

	const svg = d3.select('#time_series_svg')
		.attr('width', SVG_WIDTH)
		.attr('height', SVG_HEIGHT);

	const x = d3.scaleTime()
		.domain(d3.extent(Array.from(date_stats.keys()), d => Date.parse(d)))
		.range([margin.left, SVG_WIDTH - margin.right]);

	const y = d3.scaleLinear()
		.domain([0, d3.max(Array.from(date_stats.values())) + 5])
		.range([SVG_HEIGHT - margin.bottom, margin.top]);

	const line = d3.line()
		.x(d => x(Date.parse(d[0])))
		.y(d => y(d[1]))
		.curve(d3.curveMonotoneX);

	svg.append("path")
		.data([Array.from(date_stats.entries()).sort((a, b) => a[0] > b[0] ? 1 : -1)])
		.attr("class", "line")
		.attr("d", line);

	svg.selectAll(".dot")
		.data(Array.from(date_stats.entries()))
		.enter()
		.append("circle") // Uses the enter().append() method
		.attr("class", "dot") // Assign a class for styling
		.attr("cx", d => x(Date.parse(d[0])))
		.attr("cy", d => y(d[1]))
		.attr("r", 5);

	const x_axis = d3.axisBottom(x).tickFormat(d3.utcFormat("%b-%d")).tickValues(Array.from(date_stats.keys()).map(d => Date.parse(d)));

	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", `translate(0,${SVG_HEIGHT - margin.bottom})`)
		.call(x_axis);

	svg.selectAll(".text")
		.data(Array.from(date_stats.entries()))
		.enter()
		.append("text") // Uses the enter().append() method
		.attr("class", "label") // Assign a class for styling
		.attr("x", d => x(Date.parse(d[0])))
		.attr("y", d => y(d[1]))
		.attr("dy", "-6")
		.text(d => d[1]);
};

const init = () => {
	state_stats = d3.rollup(global_data['data'], v => v.length, d => (d['state']));
	city_stats = d3.rollup(global_data['data'], v => v.length, d => (d['city']));
	date_stats = d3.rollup(global_data['data'], v => v.length, d => (d['date']));
	date_stats.delete('');
	date_stats.delete(undefined);

	updateCounters();
	initStateMap();
	initTimeSeries();
};


window.onload = () => {
	Promise.all([
		d3.json('https://raw.githubusercontent.com/2020PB/police-brutality/data_build/all-locations.json'),
		d3.json('https://d3js.org/us-10m.v1.json'),
		d3.tsv('data/state-names.tsv')
	]).then(responses => {
		global_data = responses[0];
		map_data = responses[1];
		state_names = responses[2].reduce(
			(obj, item) => Object.assign(obj, { [item.id]: item.name }), {});

		init();
	});
};
