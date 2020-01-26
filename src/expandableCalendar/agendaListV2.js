import _ from 'lodash';
import React, {Component} from 'react';
import { Dimensions, Text, View, RefreshControl, SectionList, ActivityIndicator } from 'react-native';
import { RecyclerListView, DataProvider, LayoutProvider } from "recyclerlistview";
import PropTypes from 'prop-types';
import XDate from 'xdate';
import moment from "moment";

import styleConstructor from './style';
import asCalendarConsumer from './asCalendarConsumer';

const commons = require('./commons');
const UPDATE_SOURCES = commons.UPDATE_SOURCES;

const PAST_DAYS = 30;

const ViewTypes = {
  DATE: 0,
  EMPTY_DAY: 1,
  BASIC_EVENT: 2,
  DETAILED_EVENT: 3,
  MULTI_EVENTS: 4,
};

const GenerateDateArray = (start, end, events = {}) => (
  _.flatten(_.map(_.range(start.diffDays(end)), 
                  (dayIdx) => [ ({ title: start.clone().addDays(dayIdx).toString('yyyy-MM-dd'), type: "header" }),
                                ({ title: start.clone().addDays(dayIdx).toString('yyyy-MM-dd'), data: events[start.clone().addDays(dayIdx).toString('yyyy-MM-dd')] || [{}], type: "events" }) 
                              ] ))
);


/**
 * @description: AgendaList component
 * @extends: SectionList
 * @notes: Should be wraped in CalendarProvider component
 * @example: https://github.com/wix/react-native-calendars/blob/master/example/src/screens/expandableCalendar.js
 */
class AgendaList extends Component {
  static displayName = 'AgendaList';

  static propTypes = {
    // ...RecyclerListView.propTypes,
    /** day format in section title. Formatting values: http://arshaw.com/xdate/#Formatting */
    dayFormat: PropTypes.string,
    agendaEvents: PropTypes.object,
    width: PropTypes.number,
    headerHeight: PropTypes.number,
    emptyDayHeight: PropTypes.number,
    eventHeight: PropTypes.number,
    detailedEventHeight: PropTypes.number,
    renderHeader: PropTypes.func,

    withRef: PropTypes.func,
    /** style passed to the section view */
    // sectionStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.array])
  }

  static defaultProps = {
    dayFormat: 'dddd, MMM d'
  }

  DataSourceFactory = () =>
  (new DataProvider((r1, r2) => {
    return r1 !== r2;
  }));

  LayoutProviderFactory = results => {
    return new LayoutProvider(
      index => {
        if (index % 2 === 0) return ViewTypes.DATE;
        const {data} = results[index];
        if (data && (data.length === 0 || (data.length === 1 && Object.keys(data[0]).length === 0))) return ViewTypes.EMPTY_DAY;
        else if (data.length > 1) return ViewTypes.MULTI_EVENTS;
        else return ViewTypes.BASIC_EVENT;
      },
      (type, dim, index) => {
        // let { width } = Dimensions.get("window");
        let { width, headerHeight, emptyDayHeight, eventHeight, detailedEventHeight } = this.props;
        const {data} = results[index];
  
        switch (type) {
          case ViewTypes.DATE:
              dim.width = width;
              dim.height = headerHeight;
              break;
          case ViewTypes.EMPTY_DAY:
              dim.width = width;
              dim.height = emptyDayHeight;
              break;
          case ViewTypes.BASIC_EVENT:
            dim.width = width;
            if (data[0] && 
              data[0].attendees && 
              data[0].attendees.length > 0 && 
              !(data[0].attendees.length === 1 && data[0].attendees[0].self)) {
              dim.height = detailedEventHeight;
            }
            else {
              dim.height = eventHeight;
            }
            break;
          case ViewTypes.MULTI_EVENTS:
            dim.width = width;
            let height = 0;
            for (datum of data) {
              if (datum && 
                datum.attendees && 
                datum.attendees.length > 0 && 
                !(datum.attendees.length === 1 && datum.attendees[0].self)) {
                height = height + detailedEventHeight;
              }
              else {
                height = height + eventHeight;
              }
            }
            dim.height = height;//dataProvider.getDataForIndex(index).data.length;
            break;
          default:
              dim.width = 0;
              dim.height = 0;
        }
      }
    );
  }

  constructor(props) {
    super(props);
    this.style = styleConstructor(props.theme);

    this._topSection = _.get(props, 'sections[0].title');
    this.didScroll = false;
    this.sectionScroll = false;

    this.viewabilityConfig = {
      itemVisiblePercentThreshold: 20 // 50 means if 50% of the item is visible
    };
    this.list = React.createRef();

    // let dataProvider = new DataProvider((r1, r2) => {
    //   return r1 !== r2;
    // });
    const start = new XDate().addDays(-PAST_DAYS);
    const end = new XDate().addDays(30);

    this.inProgress = false;

    const agenda = GenerateDateArray(start, end, this.props.agendaEvents);
    this.state = {
      agenda,
      count: 0,
      viewType: 0,
      loading: false,
      dataProvider: this.DataSourceFactory().cloneWithRows(agenda),
    };

    // this._dataProvider = this.DataSourceFactory().cloneWithRows(agenda);
    this._layoutProvider= this.LayoutProviderFactory(agenda);
  }

  fetchPast = (date = "") => {
    if (!this.inProgress) {
      const pastEnd = new XDate(this.state.agenda[0].title);
      const pastStart = new XDate(!!date ? date : pastEnd).addDays(-PAST_DAYS);
      this.inProgress = true;
      const pastAgenda = GenerateDateArray(pastStart, pastEnd, this.props.agendaEvents);
      const fullAgenda = pastAgenda.concat(this.state.agenda);
      this.setState({
        agenda: fullAgenda,
        dataProvider: this.state.dataProvider.cloneWithRows(fullAgenda)
      });
      // this._dataProvider = this._dataProvider.cloneWithRows(fullAgenda);
      this._layoutProvider= this.LayoutProviderFactory(fullAgenda);
      // console.log("WE HERE");
      // console.log(this.state.agenda);
      setTimeout(() => this.scrollToSection(PAST_DAYS * 2-1), 250);
      this.inProgress = false;
    }
  }

  fetchFuture = (date = "") => {
    if (!this.inProgress) {
      this.inProgress = true;
      const futureStart = new XDate(this.state.agenda[this.state.agenda.length - 1].title).addDays(1);
      const futureEnd = new XDate(date || futureStart).addDays(60);
      // console.log(futureEnd);
      // console.log(date || futureStart);
      const futureAgenda = GenerateDateArray(futureStart, futureEnd, this.props.agendaEvents);
      const fullAgenda = this.state.agenda.concat(futureAgenda);
      this.setState({
        agenda: fullAgenda,
        dataProvider: this.state.dataProvider.cloneWithRows(fullAgenda),
      });
      // this._dataProvider = this._dataProvider.cloneWithRows(fullAgenda);
      this._layoutProvider= this.LayoutProviderFactory(fullAgenda);
      this.inProgress = false;
    }
  }

  handleListEnd = () => {
    this.fetchFuture();

    //This is necessary to ensure that activity indicator inside footer gets rendered. This is required given the implementation I have done in this sample
    // this.setState({});
  };
  renderFooter = () => {
    //Second view makes sure we don't unnecessarily change height of the list on this event. That might cause indicator to remain invisible
    //The empty view can be removed once you've fetched all the data
    return this.inProgress
      ? <ActivityIndicator
          style={{ margin: 10, flex: 1}}
          size="small"
          color={'black'}
        />
      : <View style={{ height: 60 }} />;
  };
  

  getSectionIndex(date) {
    let i;
    _.map(this.state.agenda, (section, index) => {
      // NOTE: sections titles should match current date format!!!
      if (section.title === date) {
        i = index;
        return;
      }
    });
    return i;
  }

  componentDidMount() {
    const sectionIndex = this.getSectionIndex(XDate().toString('yyyy-MM-dd'));
    // this.scrollToSection(sectionIndex);
  }

  componentDidUpdate(prevProps) {
    // console.log("HERE");
    const {updateSource, date} = this.props.context;
    if (date !== prevProps.context.date) {
      // NOTE: on first init data should set first section to the current date!!!
      if (updateSource !== UPDATE_SOURCES.LIST_DRAG && updateSource !== UPDATE_SOURCES.CALENDAR_INIT) {
        const sectionIndex = this.getSectionIndex(date);
        if (sectionIndex === undefined) {
          console.log("HERE");
          if (new XDate(date).diffDays(new XDate(prevProps.context.date)) > 0) {
            this.fetchPast(date);
          } else {
            this.fetchFuture(date);
          }
        }
        this.scrollToSection(sectionIndex);
      }
    }
  }

  scrollToSection(sectionIndex) {
    console.log(sectionIndex);
    if (this.list && sectionIndex !== undefined) {
      this.list.scrollToIndex(sectionIndex);
    }
  }

  onViewableItemsChanged = (all, now, notNow) => {
    // console.log(all);
    // console.log(now);
    // console.log(notNow);
    // console.log(now);
    if (all && !this.sectionScroll) {
      const topSection =  _.get(this.state.dataProvider.getDataForIndex(all[0]), 'title');
      if (topSection && topSection !== this._topSection) {
        // console.log(topSection)
        this._topSection = topSection;
        if (this.didScroll) { // to avoid setDate() on first load (while setting the initial context.date value)
          _.invoke(this.props.context, 'setDate', this._topSection, UPDATE_SOURCES.LIST_DRAG);
        }
      }
    }
  }

  onScroll = (event) => {
    if (!this.didScroll) {
      this.didScroll = true;
    }
    _.invoke(this.props, 'onScroll', event);
  }

  onMomentumScrollBegin = (event) => {
    _.invoke(this.props.context, 'setDisabled', true);
    _.invoke(this.props, 'onMomentumScrollBegin', event);
  }

  onMomentumScrollEnd = (event) => {
    // when list momentum ends AND when scrollToSection scroll ends
    this.sectionScroll = false;
    _.invoke(this.props.context, 'setDisabled', false);
    _.invoke(this.props, 'onMomentumScrollEnd', event);
  }

  // keyExtractor = (item, index) => String(index);

  render() {
    return (
      <View style={{ flex: 1 }}>
        {this.props.renderHeader(this.props.context.date)}
        <RecyclerListView
          // {...this.props}
          rowRenderer={this.props.rowRenderer}
          style={{ flex: 1 }}
          ref={rlv => {
            this.list = rlv; 
            this.props.withRef(rlv);
          }}
          layoutProvider={this._layoutProvider}
          dataProvider={this.state.dataProvider}
          // forceNonDeterministicRendering
          initialRenderIndex={PAST_DAYS * 2 + 1}
          onVisibleIndicesChanged={this.onViewableItemsChanged}
          onScroll={this.onScroll}
          onEndReached={this.fetchFuture}
          // onEndReachedThreshold={200}
          renderFooter={this.renderFooter}
          scrollViewProps={{
            onMomentumScrollBegin: this.onMomentumScrollBegin,
            onMomentumScrollEnd: this.onMomentumScrollEnd,
            // onScrollToTop: () => console.log("AT TOPP"),
            refreshControl: (
              <RefreshControl
                refreshing={this.state.loading}
                onRefresh={() => {
                  this.setState({ loading: true });
                  this.fetchPast();
                  this.setState({ loading: false });
                }}
              />
            )
          }}
        />
      </View>

    );
  }

}

export default asCalendarConsumer(AgendaList);
