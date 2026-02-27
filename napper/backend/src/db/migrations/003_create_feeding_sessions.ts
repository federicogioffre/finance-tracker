import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('feeding_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('baby_id').notNullable().references('id').inTable('babies').onDelete('CASCADE');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').nullable();
    // 'breast' | 'bottle' | 'solid'
    table.string('feed_type').notNullable();
    // ml for bottle, minutes for breast, grams for solid
    table.decimal('quantity', 8, 2).nullable();
    table.string('quantity_unit').nullable(); // 'ml' | 'min' | 'g'
    // left | right | both (for breast)
    table.string('breast_side').nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.index(['baby_id', 'start_time']);
    table.index(['baby_id', 'feed_type']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('feeding_sessions');
}
