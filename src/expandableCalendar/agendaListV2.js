import _ from 'lodash';
import React, {Component} from 'react';
import { Dimensions, Text, View, SectionList } from 'react-native';
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
  EVENTS: 1
};

const GenerateDateArray = (start, end) => (
  _.flatten(_.map(_.range(start.diffDays(end)), 
                  (dayIdx) => [ ({ title: start.clone().addDays(dayIdx).toString('yyyy-MM-dd'), type: "header" }),
                                ({ title: start.clone().addDays(dayIdx).toString('yyyy-MM-dd'), data: [{}], type: "events" }) 
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

    this._layoutProvider = new LayoutProvider(
      index => {
        if (index % 2 === 0) return ViewTypes.DATE;
        else return ViewTypes.EVENTS;
      },
      (type, dim) => {
        let { width } = Dimensions.get("window");
        switch (type) {
          case ViewTypes.DATE:
              dim.width = width;
              dim.height = 42.5;
              break;
          case ViewTypes.EVENTS:
              dim.width = width;
              dim.height = 40;
              break;
          default:
              dim.width = 0;
              dim.height = 0;
        }
      }
    );

    this.state = {
      dataProvider: dataProvider.cloneWithRows(GenerateDateArray(start, end)),
      agenda: [],
      count: 0,
      viewType: 0,
    };


    // const start = new XDate().addDays(-1);
    // const end = new XDate().addDays(30);
  
    // const [dates, dispatch] = useReducer((dates, action) => {
    //   switch (action.type) {
    //     case 'loadPast': 
    //       const pastEnd = new XDate(dates[0].title);
    //       const pastStart = new XDate(pastEnd).addDays(-30);
    
    //       return [ ...GenerateDateArray(pastStart, pastEnd), ...dates];
    //     case 'loadFuture':
    //       const futureStart = new XDate(dates[dates.length - 1].title).addDays(1);
    //       const futureEnd = new XDate(futureStart).addDays(30);
    
    //       return [ ...dates, ...GenerateDateArray(futureStart, futureEnd) ];
    //     default:
    //       throw new Error();
    //   }
    // }, GenerateDateArray(start, end) );


  }

  

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
    if (viewableItems && !this.sectionScroll) {
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
        {...this.props}
        ref={rlv => this.list = rlv}
        layoutProvider={this._layoutProvider}
        dataProvider={this.dataProvider}
        forceNonDeterministicRendering
        initialRenderIndex={20}
        onVisibleIndicesChanged={this.onViewableItemsChanged}
        onScroll={this.onScroll}
        scrollViewProps={{
          onMomentumScrollBegin: this.onMomentumScrollBegin,
          onMomentumScrollEnd: this.onMomentumScrollEnd,
          onScrollToTop: () => console.log("AT TOPP")
        }}
      />
    );
  }

}

export default asCalendarConsumer(AgendaList);
