import React, {PropTypes} from 'react';

import {
    StyleSheet,
    View,
    Platform,
    PullToRefreshViewAndroid,
    ListView
} from 'react-native';

import RefreshingIndicator from './RefreshingIndicator';

const SCROLL_EVENT_THROTTLE       = 32;
const MIN_PULLDOWN_DISTANCE       = 40;
const REFRESHING_INDICATOR_HEIGHT = 60;
const LISTVIEW_REF                = 'listview';

/*
 * state transitions:
 *   {isRefreshing: false}
 *   v - show loading spinner
 *   {isRefreshing: true, waitingForRelease: true}
 *   v - reset scroll position, offset scroll top
 *   {isRefreshing: true, waitingForRelease: false}
 *   v - hide loading spinner
 *   {isRefreshing: false}
 */

export default class RefreshableListView extends React.Component {
  
    static propTypes = {
        colors                        : PropTypes.array,
        progressBackgroundColor       : PropTypes.string,
        onRefresh                     : PropTypes.func.isRequired,
        isRefreshing                  : PropTypes.bool.isRequired,
        waitingForRelease             : PropTypes.bool,
        onHold                        : PropTypes.func,
        onPull                        : PropTypes.func,
        pullingPrompt                 : PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        pullingIndicator              : PropTypes.oneOfType([PropTypes.func, PropTypes.element]),
        holdingPrompt                 : PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        holdingIndicator              : PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        refreshDescription            : PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        refreshingPrompt              : PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        minPulldownDistance           : PropTypes.number,
        ignoreInertialScroll          : PropTypes.bool,
        scrollEventThrottle           : PropTypes.number,
        onScroll                      : PropTypes.func,
        onResponderGrant              : PropTypes.func,
        onResponderRelease            : PropTypes.func
    };

    static defaultProps = {
        minPulldownDistance          : MIN_PULLDOWN_DISTANCE,
        scrollEventThrottle          : SCROLL_EVENT_THROTTLE,
        ignoreInertialScroll         : true,
        pullingPrompt                : 'Pull to refresh',
        holdingPrompt                : 'Release to refresh'
    };

    state = {
        waitingForRelease : false
    };

    componentWillReceiveProps(nextProps) {
        if (!this.props.isRefreshing && nextProps.isRefreshing && this.isTouching) {
            this.waitingForRelease = true;
            this.setState({waitingForRelease : true})
        }
    }

    componentWillUpdate(nextProps, nextState) {
        if (Platform.OS === 'ios') {
            if (
                this.isReleaseUpdate(this.props, this.state, nextProps, nextState)
            ) {

                this.getScrollResponder().scrollTo(
                    {
                        x        : -(this.lastContentInsetTop + REFRESHING_INDICATOR_HEIGHT),
                        y        : this.lastContentOffsetX,
                        animated : true
                    }
                );
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (Platform.OS === 'ios') {
            if (
                this.isReleaseUpdate(prevProps, prevState, this.props, this.state)
            ) {

                this.getScrollResponder().scrollTo(
                    {
                        x        : -(this.lastContentInsetTop),
                        y        : this.lastContentOffsetX,
                        animated : true
                    }
                );
            }
        }
    }

    handlePullToRefreshViewAndroidRef(swipeRefreshLayout) {
        this.swipeRefreshLayout = swipeRefreshLayout
    }

    handleScroll(e) {
        let scrollY              = e.nativeEvent.contentInset.top + e.nativeEvent.contentOffset.y;
        this.lastScrollY         = scrollY;
        this.lastContentInsetTop = e.nativeEvent.contentInset.top;
        this.lastContentOffsetX  = e.nativeEvent.contentOffset.x;

        if (!this.props.isRefreshing) {
            if ((this.isTouching && scrollY < 0) || (!this.isTouching && !this.props.ignoreInertialScroll)) {
                if (scrollY < -this.props.minPulldownDistance) {
                    if (!this.isWaitingForRelease()) {
                        this.waitingForRelease = true;
                        this.setState({waitingForRelease : true});
                        this.props.onHold()
                    }
                } else {
                    if (this.isWaitingForRelease()) {
                        this.waitingForRelease = false;
                        this.setState({waitingForRelease : false});
                    }
                    this.props.onPull();
                }
            }
        }

        this.props.onScroll && this.props.onScroll(e)
    }

    handleResponderGrant() {
        this.isTouching = true;
        if (this.props && this.props.onResponderGrant) {
            this.props.onResponderGrant.apply(this, arguments)
        }
    }

    handleResponderRelease() {
        this.isTouching = false;
        if (this.props.onResponderRelease) {
            this.props.onResponderRelease.apply(this, arguments)
        }
        if (this.isWaitingForRelease()) {
            this.waitingForRelease = false;
            this.setState({waitingForRelease : false});
            if (!this.props.isRefreshing) {
                if (this.props.onRefresh) {
                    this.props.onRefresh()
                }
            }
        }
        this.props.onPull()
    }

    getContentContainerStyle() {
        if (!this.props.isRefreshing || this.isWaitingForRelease()) return null;

        return {marginTop : REFRESHING_INDICATOR_HEIGHT}
    }

    getScrollResponder() {
        return this.refs[LISTVIEW_REF].getScrollResponder()
    }

    setNativeProps(props) {
        this.refs[LISTVIEW_REF].setNativeProps(props)
    }

    isWaitingForRelease() {
        return this.waitingForRelease || this.props.waitingForRelease
    }

    isReleaseUpdate(oldProps, oldState, newProps, newState) {
        return (
            (!oldProps.isRefreshing && newProps.isRefreshing && !this.waitingForRelease) ||
            (oldProps.isRefreshing && oldState.waitingForRelease && !newState.waitingForRelease)
        )
    }

    renderRefreshingIndicator() {
        let {
                isRefreshing,
                pullingPrompt,
                holdingPrompt,
                refreshingPrompt,
                refreshDescription,
                pullingIndicator,
                holdingIndicator,
                refreshingIndicator,
            } = this.props;
        let refreshingIndicatorProps = {
            isRefreshing,
            pullingIndicator,
            holdingIndicator,
            refreshingIndicator,
            pullingPrompt       : pullingPrompt || refreshDescription,
            holdingPrompt       : holdingPrompt || refreshDescription,
            refreshingPrompt    : refreshingPrompt || refreshDescription,
            isTouching          : this.isTouching,
            isWaitingForRelease : this.isWaitingForRelease()
        };

        return (
            <View style={[stylesheet.fillParent]}>
                <RefreshingIndicator {...refreshingIndicatorProps} />
            </View>
        );
    }

    render() {
        if (Platform.OS === 'android') {
            return (
                <PullToRefreshViewAndroid
                    ref={this.handlePullToRefreshViewAndroidRef.bind(this)}
                    onRefresh={this.props.onRefresh}
                    colors={this.props.colors}
                    progressBackgroundColor={this.props.progressBackgroundColor}
                    style={stylesheet.container}
                >
                    <ListView
                        {...this.props}
                        ref={LISTVIEW_REF}
                    />
                </PullToRefreshViewAndroid>
            )
        } else {
            return (
                <View style={[stylesheet.container]}>
                    {this.renderRefreshingIndicator()}
                    <View style={[stylesheet.fillParent]}>
                        <ListView
                            {...this.props}
                            ref={LISTVIEW_REF}
                            contentContainerStyle={this.getContentContainerStyle()}
                            onScroll={this.handleScroll.bind(this)}
                            scrollEventThrottle={this.props.scrollEventThrottle}
                            onResponderGrant={this.handleResponderGrant.bind(this)}
                            onResponderRelease={this.handleResponderRelease.bind(this)}
                        />
                    </View>
                </View>
            )
        }
    }
}

const stylesheet = StyleSheet.create({
    container  : {
        flex : 1
    },
    fillParent : {
        backgroundColor : 'transparent',
        position        : 'absolute',
        top             : 0,
        left            : 0,
        right           : 0,
        bottom          : 0
    }
});
