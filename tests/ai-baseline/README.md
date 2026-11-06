This is the immutable AI policy baseline at d64208e03883edb7de85e9fde9675d6605969498,
just before availability and going-out improvements. Do not tune these files.

The three AI modules are copied with import paths adjusted to shared game types.
The adapter preserves the original hand/form order for table additions and does
not add to tables on the laydown turn. Game rules, card identities and deck rules
are shared by both policies. The runner checks hashes of the frozen source and
shared rule files. Twenty recorded historical rounds are replayed by unit tests.

Create a separately versioned baseline for future comparisons; never silently
update this snapshot to incorporate new AI behaviour.
