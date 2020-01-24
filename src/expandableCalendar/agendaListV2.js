import _ from 'lodash';
import React, {Component} from 'react';
import { Dimensions, Text, View, RefreshControl, SectionList } from 'react-native';
import { RecyclerListView, DataProvider, LayoutProvider } from "recyclerlistview";
import PropTypes from 'prop-types';
import XDate from 'xdate';
import moment from "moment";

import styleConstructor from './style';
import asCalendarConsumer from './asCalendarConsumer';

const commons = require('./commons');
const UPDATE_SOURCES = commons.UPDATE_SOURCES;

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
    profileHeight: PropTypes.number
    /** style passed to the section view */
    // sectionStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.array])
  }

  static defaultProps = {
    dayFormat: 'dddd, MMM d'
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

    let dataProvider = new DataProvider((r1, r2) => {
      return r1 !== r2;
    });
    const start = new XDate().addDays(-10);
    const end = new XDate().addDays(30);

    this.inProgress = false;

    const agenda = GenerateDateArray(start, end, this.props.agendaEvents);
    this.state = {
      dataProvider: dataProvider.cloneWithRows(agenda),
      agenda,
      count: 0,
      viewType: 0,
      loading: false,
    };

    this._layoutProvider = new LayoutProvider(
      index => {
        if (index % 2 === 0) return ViewTypes.DATE;
        const {data} = this.state.dataProvider.getDataForIndex(index);
        if (data && data.length === 0) return ViewTypes.EMPTY_DAY;

        return ViewTypes.BASIC_EVENT;
      },
      (type, dim, index) => {
        // let { width } = Dimensions.get("window");
        let { width, headerHeight, emptyDayHeight, eventHeight, profileHeight } = this.props;
        const {data} = this.state.dataProvider.getDataForIndex(index);

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
            if (data[0] && data[0].attendees && data[0].attendees.length > 0) dim.height = eventHeight + profileHeight - 1;
            else dim.height = eventHeight - 1;
            break;
          case ViewTypes.MULTI_EVENTS:
            dim.width = width;
            let height = -1;
            for (datum of data) {
              if (datum && datum.attendees && datum.attendees.length > 0) height = height + eventHeight + profileHeight;
              else height = height + eventHeight;
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

  fetchPast = () => {
    if (!this.inProgress) {
      const pastEnd = new XDate(this.state.agenda[0].title);
      const pastStart = new XDate(pastEnd).addDays(-30);
      this.inProgress = true;
      const pastAgenda = GenerateDateArray(pastStart, pastEnd, this.props.agendaEvents);
      this.setState({
        dataProvider: this.state.dataProvider.cloneWithRows(
          pastAgenda.concat(this.state.agenda)
        ),
        agenda: pastAgenda.concat(this.state.agenda)
      });
      this.inProgress = false;
    }
  }

  fetchFuture = () => {
    if (!this.inProgress) {
      const futureStart = new XDate(this.state.agenda[this.state.agenda.length - 1].title);
      const futureEnd = new XDate(futureStart).addDays(30);
      this.inProgress = true;
      const futureAgenda = GenerateDateArray(futureStart, futureEnd, this.props.agendaEvents);
      this.setState({
        dataProvider: this.state.dataProvider.cloneWithRows(
          this.state.agenda.concat(futureAgenda)
        ),
        agenda: this.state.agenda.concat(futureAgenda)
      });
      this.inProgress = false;
    }
  }

  handleListEnd = () => {
    this.fetchFuture();

    //This is necessary to ensure that activity indicator inside footer gets rendered. This is required given the implementation I have done in this sample
    this.setState({});
  };
  renderFooter = () => {
    //Second view makes sure we don't unnecessarily change height of the list on this event. That might cause indicator to remain invisible
    //The empty view can be removed once you've fetched all the data
    return this.inProgress
      ? <ActivityIndicator
          style={{ margin: 10 }}
          size="large"
          color={'black'}
        />
      : <View style={{ height: 60 }} />;
  };
  

  getSectionIndex(date) {
    // let i;
    // _.map(this.props.sections, (section, index) => {
    //   // NOTE: sections titles should match current date format!!!
    //   if (section.title === date) {
    //     i = index;
    //     return;
    //   }
    // });
    // return i;
  }

  componentDidMount() {
    // const sectionIndex = this.getSectionIndex(XDate().toString('yyyy-MM-dd'));
    // this.scrollToSection(sectionIndex);
  }

  componentDidUpdate(prevProps) {
    // const {updateSource, date} = this.props.context;
    // if (date !== prevProps.context.date) {
    //   // NOTE: on first init data should set first section to the current date!!!
    //   if (updateSource !== UPDATE_SOURCES.LIST_DRAG && updateSource !== UPDATE_SOURCES.CALENDAR_INIT) {
    //     const sectionIndex = this.getSectionIndex(date);
    //     this.scrollToSection(sectionIndex);
    //   }
    // }
  }

  scrollToSection(sectionIndex) {
    this.list.scrollToIndex(20);
  }


  onViewableItemsChanged = (all, now, notNow) => {
    // console.log(now);
    if (now && !this.sectionScroll) {
      const topSection =  _.get(this.state.dataProvider.getDataForIndex(now[0]), 'title');
      if (topSection && topSection !== this._topSection) {
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


  onHeaderLayout = ({nativeEvent}) => {  }

  renderSectionHeader = ({section: {title}}) => {
  }

  // keyExtractor = (item, index) => String(index);

  render() {
    return (
      <RecyclerListView
        // {...this.props}
        rowRenderer={this.props.rowRenderer}
        style={{ flex: 1 }}
        ref={rlv => this.list = rlv}
        layoutProvider={this._layoutProvider}
        dataProvider={this.state.dataProvider}
        forceNonDeterministicRendering
        initialRenderIndex={20}
        onVisibleIndicesChanged={this.onViewableItemsChanged}
        onScroll={this.onScroll}
        onEndReached={this.handleListEnd}
        renderFooter={this.renderFooter}
        scrollViewProps={{
          onMomentumScrollBegin: this.onMomentumScrollBegin,
          onMomentumScrollEnd: this.onMomentumScrollEnd,
          onScrollToTop: () => console.log("AT TOPP"),
          refreshControl: (
            <RefreshControl
              refreshing={this.state.loading}
              onRefresh={() => {
                this.setState({ loading: true });
                this.fetchPast();
                this.list.scrollToIndex(60);
                this.setState({ loading: false });
              }}
            />
          )
        }}
      />
    );
  }

}

export default asCalendarConsumer(AgendaList);
