import {StyleSheet} from 'react-native';
import {Colors} from '../styles/Colors';
import {Spacing} from '../styles/Spacing';
import {Fonts} from '../styles/Fonts';

export const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.small,
    paddingBottom: Spacing.small,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    elevation: 1,
  },
  backButton: {
    marginRight: Spacing.small,
  },
  headerTitle: {
    flex: 1,
    fontSize: Fonts.size.xlarge,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginLeft: -Spacing.large,
  },
  headerActions: {
    width: 80, // Placeholder for symmetry
  },
  markAllReadButtonLabel: {
    fontSize: Fonts.size.small,
    color: Colors.primary,
    fontWeight: '500',
  },
  disabledButtonLabel: {
    color: Colors.lightGray,
  },
  markAllReadButtonContent: {
    height: 36,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.small,
    paddingHorizontal: Spacing.medium,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChip: {
    marginHorizontal: Spacing.tiny,
    backgroundColor: Colors.lightGray + '30',
    borderRadius: 20,
    height: 36,
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Fonts.size.medium,
    color: Colors.text,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: Colors.lightText,
  },
  urgentChip: {
    backgroundColor: Colors.danger + '20',
    borderColor: Colors.danger,
    borderWidth: 1,
  },
  urgentChipText: {
    color: Colors.danger,
    fontWeight: '600',
  },
  scrollViewContent: {
    padding: Spacing.medium,
    backgroundColor: Colors.background,
  },
  notificationCard: {
    marginBottom: Spacing.small,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  unreadCard: {
    backgroundColor: Colors.unreadNotification,
    borderLeftWidth: 4,
    borderColor: Colors.primary,
  },
  urgentCard: {
    borderLeftWidth: 4,
    borderColor: Colors.danger,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.medium,
  },
  iconContainer: {
    marginRight: Spacing.medium,
    padding: Spacing.small,
    backgroundColor: Colors.lightGray + '15',
    borderRadius: 25,
  },
  textContainer: {
    flex: 1,
    marginRight: Spacing.small,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.tiny,
  },
  notificationTitle: {
    flex: 1,
    fontSize: Fonts.size.large,
    fontWeight: 'bold',
    color: Colors.text,
    marginRight: Spacing.small,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.tiny,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontSize: Fonts.size.small,
    color: Colors.lightText,
    fontWeight: 'bold',
  },
  notificationMessage: {
    fontSize: Fonts.size.medium,
    color: Colors.gray,
    lineHeight: Fonts.size.large * 1.4,
    marginBottom: Spacing.tiny,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTimestamp: {
    fontSize: Fonts.size.small,
    color: Colors.lightGray,
  },
  actionRequiredText: {
    fontSize: Fonts.size.small,
    color: Colors.danger,
    fontWeight: '600',
  },
  actionsContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginBottom: Spacing.small,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.medium,
    fontSize: Fonts.size.medium,
    color: Colors.gray,
  },
  loadMoreContainer: {
    paddingVertical: Spacing.medium,
    alignItems: 'center',
  },
  loadMoreButton: {
    borderColor: Colors.primary,
  },
  loadMoreButtonLabel: {
    color: Colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xlarge * 2,
    paddingHorizontal: Spacing.large,
  },
  emptyText: {
    fontSize: Fonts.size.xlarge,
    fontWeight: 'bold',
    color: Colors.gray,
    marginTop: Spacing.medium,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: Fonts.size.medium,
    color: Colors.lightGray,
    marginTop: Spacing.small,
    textAlign: 'center',
    lineHeight: Fonts.size.large * 1.4,
  },
  emptyStateButton: {
    marginTop: Spacing.large,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  emptyStateButtonLabel: {
    color: Colors.lightText,
    fontSize: Fonts.size.medium,
    paddingHorizontal: Spacing.medium,
    paddingVertical: Spacing.tiny,
  },
  snackbar: {
    backgroundColor: Colors.text,
  },
});
