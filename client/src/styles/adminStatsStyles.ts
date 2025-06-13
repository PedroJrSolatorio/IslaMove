import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeFrameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  timeFrameButton: {
    marginHorizontal: 4,
  },
  timeFrameLabel: {
    textAlign: 'center',
    marginVertical: 8,
    fontWeight: 'bold',
  },
  statCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    margin: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#555',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statSubtext: {
    fontSize: 12,
    color: '#777',
  },
  metricsCard: {
    marginVertical: 8,
  },
  metricItem: {
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 14,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  fullWidthCard: {
    marginVertical: 8,
  },
  cancellationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cancellationItem: {
    alignItems: 'center',
  },
  cancellationLabel: {
    fontSize: 12,
    color: '#555',
  },
  cancellationValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionCard: {
    marginVertical: 8,
  },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  badge: {
    marginRight: 8,
  },
  attentionDivider: {
    marginVertical: 4,
  },
});
